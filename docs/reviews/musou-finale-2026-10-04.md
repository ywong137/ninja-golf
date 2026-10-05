# Musou activation and finale

Charged F now interrupts light attacks, heavy attacks, dodges, guard recovery, and hit-stop. It clears queued strikes before the cinematic. Normal attacks retain the accepted movement and cancellation rules.

The intro lasts 4.2 seconds. The eye wipe lasts 1.32 seconds. The portrait wipe starts at 1.26 seconds and lasts 1.14 seconds. Each wipe has a recorded air sweep, a lower air layer, and a short blade accent. CSS, sound events, and the camera use the same clock. Pausing also pauses the visual timeline.

The live portrait uses a warm camera-relative key and a cool rim, matching the existing artwork. Course lights become weaker during that render and restore afterward.

All six ultimates use complete fitted captures. Five heroes use visible chains; the Shinobi retains explicit disappearances between source performances. Each clip keeps its body motion, grip metadata, root path, and impact timing. The public chains use existing licensed Mixamo and CC0 captures. No purchased polearm data enters the public build.

| Hero | Duration | Contacts |
| --- | ---: | ---: |
| Ronin | 8.55 s | 9 |
| Shinobi | 9.17 s | 6 |
| Vice President | 7.20 s | 9 |
| Ace | 7.43 s | 9 |
| Hustler | 8.50 s | 7 |
| Closer | 8.03 s | 7 |

The private Vice President preview uses the purchased polearm combination, advancing thrust, and combination finish: 8.17 seconds and seven contacts. This configuration stays outside the release checkout.

Musou uses wider, brighter blade ribbons with a longer fade. Early hits stagger enemies. The final radial hit adds a larger launch and surrounding blasts. The camera pulls back to show the full performance. Contact flashes and explosions share the bounded instanced pool.

Validation before publication:

- Thirty actual F-input interruption cases passed across all six heroes.
- All six complete sequences returned to normal combat without missing weapons or nonfinite poses.
- Five private interruption cases and the captured polearm sequence passed.
- Two wipe cues fired per intro. Offline audio rendering found no clipped samples; speakers stayed muted.
- Twenty-seven portrait obstruction comparisons passed across nine hero/course cases and three quality settings.
- Ordinary mouse attack and reversal checks passed for Ethan and the Ace.
- A 28-enemy scene verified stagger, actual contact positions, final launches, and effect cleanup.

Review artifacts live under the primary checkout's `artifacts/reviews/musou-finale/`. The first crowd run exposed separate flash allocations; the revised version batches them. Performance results must identify the tested revision and machine load.
