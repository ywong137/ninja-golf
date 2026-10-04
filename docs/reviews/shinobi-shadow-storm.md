# Shinobi Shadow storm

The Shinobi now performs four complete attacks during musou. The sequence alternates right and left blades, then ends with two jumping cuts. Three 240 ms smoke transitions separate the different starting stances. The body disappears during each transition and travels 1.65 world metres. Normal terrain and obstacle collision still apply.

The sequence lasts 6.033 seconds after the existing face cinematic. Four timed hits retain the previous six-hit total damage. Preparation, impact, and recovery come from the accepted native performances. No new GLB data, pose fitting, model geometry, outfit, or facial targets were added.

The source clips are Shinobi_Stepping_Cut, Shinobi_Left_Stepping_Cut, Shinobi_Airborne_Cut, and Shinobi_Left_Airborne_Cut. Each uses its existing hand attachment and root path. Explicit smoke transitions avoid interpolating across incompatible foot stances and blade mounts.

The camera moves closer during this sequence unless reduced motion is enabled. Cutting waves expand to the actual damage reach. The musou bloom threshold now preserves white clothing detail. Contact flashes, sparks, recorded hits, and enemy launches remain active.

## Verification

- Nine installed gameplay cases pass at 40, 60, and 144 Hz. Cases cover standing, running, and queued-light recovery.
- Four real damage events, final radial coverage, both grips, finite joints, and control return pass.
- Wall collision, pause during disappearance, cancellation, and restart pass at the same frame rates.
- All six heroes retain their weapons through 2,900 cinematic, attack, and recovery frames. Only the whole Shinobi disappears during the three specified smoke intervals.
- A 48-enemy encounter averaged 57.91 FPS, with a 22.6 ms p95 frame time, on the M1 Max at 1440×900 and render ratio 1. This is one local test.
- The production build passes exact bundle, nine model, two portrait, and ten recording checks. All six selections and a golf-to-combat transition pass without browser errors.
- Nine new unit tests verify source clocks, root paths, event timing, effect direction, reach, and cleanup.
- The candidate joint audit sampled 1,274 limbs. Knees bend 9.38–117.96 degrees; elbows bend 8.00–99.41 degrees. No reversed hinges occur. Maximum wrist rotation is 26.43 degrees. Elbow deviation reaches 1.46 degrees during the initial blend and 0.059 degrees in the source performances.

Opus 5.5 High accepted the stills' major body mechanics. Its concerns about white clothing glare, distant framing, and unexplained distant hits led to the bloom, camera, and wave changes. Stills do not establish animation timing; muted gameplay recordings cover playback.

The four attacks retain pauses and recoveries. This is a substantial improvement over isolated arm swings, but it does not establish AAA choreography. The Closer's eye expression still needs improvement. Her fringe hides much of the frown. This change does not claim a new angry face texture.

Private evidence is under artifacts/reviews/shinobi-shadow-sequence in the primary workspace. Installed checks use browser-shadow-sequence.mjs, browser-shadow-lifecycle.mjs, and browser-musou-weapons.mjs. Set NINJA_BASE_URL to the development server. Every test browser is muted.
