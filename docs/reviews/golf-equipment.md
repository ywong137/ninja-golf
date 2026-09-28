# Golf equipment and contact review

The candidate shapes live in `tools/art-candidates/golf-club.js`.
They do not enter the current game bundle.

The candidate supplies a rounded driver, fairway wood, cavity-back iron, wedge, and mallet putter.
Each head uses six draws and shared materials and geometry.
The visible head costs 1,120–2,760 triangles.
The grip keeps its existing 12 mm radius and 210 mm length.
The shaft tapers from a 5 mm radius to a 2.9 mm radius.

## Verified candidate behavior

- All eight club selections chose the correct shape in a muted browser.
- The 150 existing golf phase checks passed for both hands, shaft length, joins, and six authored contacts.
- A fixed clubhead rotation follows the sampled impact hand frame. It never changes a wrist or pose.
- The clubface normal points within 5.7 degrees of the shot direction at the six checked swing contacts.
- The production build passed, with the existing large-bundle warning.

## Why the candidate is not installed

The contact convention needs correction before these heads can look credible in play.
The ball currently has a 130 mm radius. Its diameter exceeds the width of the new driver head.
The address and swing contact targets put the shaft endpoint at the ball's center.
Thus the enlarged ball hides the new head.
The old cylinder also used this contact convention.

The current clips also inherit club roll from the sword grip.
That gave roughly 65–89 degrees of unwanted head rotation in the checked models.
The candidate samples the impact bone tracks and the fixed golf grip frame once.
It then sets one constant head-to-shaft rotation.
The physical face uses club-local −Z, which faces the shot in the new authored golf frame.

Changing the ball size alone would leave the authored contact above the ball.
Moving the club alone would detach its grip from the hands.
The next integration must reconcile the ball surface, clubface, hosel, shaft endpoint, and authored contact together.
It must also preserve distant ball visibility and test the putting contact.

The independent [contact audit](golf-equipment-contact.md) measured all six current actors.
It also found an incorrect head lie angle and different putt contact heights.
Its isolated geometry prototype preserves the hands, but produces excessive shaft lengths and misses the wedge's finite face.
That prototype remains diagnostic. Production needs explicit shaft sockets and face markers, with poses fitted to each club's dimensions.

## Physical contact study

`tools/art-candidates/golf-contact-study.mjs` now supplies a separate geometric reference.
It remains outside the game bundle and does not change any character pose.
Its saved measurements are in `tools/art-candidates/golf-contact-study.json`.

Each club has distinct design targets for length, lie, and loft.
The length field explicitly measures the grip butt to the shaft socket, excluding the head beyond that socket.
These targets are art dimensions, not equipment certification or a copy of a commercial club.
The driver uses a 20 mm tee lift. The other clubs meet a ball on the ground.

The study shapes the sole after applying loft. The former thick wedge back extended below its leading edge and caused missed contact.
The head keeps one fixed mount. It does not rotate separately during a swing.
Both palm stations, the shaft socket, the finite face point, and its normal have distinct markers.
Marker coordinates use metres in the club's local frame.

All eight finite faces touch a 42.67 mm diameter ball within numerical precision.
Each sole remains 2 mm above the ground in its reference pose.
The decorative groove strips protrude by up to 0.67 mm into that ideal ball surface.
Those strips need a later material treatment; the saved report distinguishes them from the physical face.

The reference driver grip sits 969 mm above the ground. The putter grip sits 774 mm above it.
This confirms that one fixed address pose cannot establish correct contact for every club.
The body fitting must use the selected club's markers and dimensions.
The study does not justify extending the shaft to compensate for an incorrect body pose.

The isolated front and side review is `/tmp/ninja-physical-clubs-v2.png`.
The driver ball's tee lift is visible there; the diagnostic scene does not include the tee mesh.
The production ball and club remain unchanged.

## Local review files

- `/tmp/ninja-club-heads-v1.png`: isolated face and back views.
- `/tmp/ninja-club-game-driver.png`: the contact overlap in the current scene.
- `/tmp/ninja-club-game-putter.png`: the same issue with the putter.
- `/tmp/ninja-club-game-check.json`: all eight selection results and browser errors.
- `/tmp/ninja-club-runtime-candidate.patch`: the temporary actor and selection integration, removed from runtime after review.

The images are diagnostic views. They do not establish finished golf artwork or a correct swing.
