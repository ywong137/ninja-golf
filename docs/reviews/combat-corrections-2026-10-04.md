# Combat corrections — October 4, 2026

## Reported defects

The Closer’s front panel crossed her thigh. Musou showed black rays over a neutral character. Impacts lacked weight and visibility.

## Causes and changes

The cloth selector skipped the first four primitives. The Closer’s tunic shares the first primitive with her trousers.
The selector now identifies connected hanging pieces within that material. It excludes trouser vertices from the cloth correction.
The thigh fit still uses those trouser vertices. The transition near the hip blends into the fixed waist.

The musou CSS used a relative portrait URL. Production resolved it beneath `/assets/`, while the preload used the correct root path.
The failed image request returned the HTML fallback with status 200. The earlier preload check therefore passed incorrectly.
The CSS now receives an absolute URL resolved against the document. A new production test decodes that exact background image.

Hits now use recorded flesh impacts with crunch, blade, and metal layers. The previous punch samples remain archived but do not play.
Contact effects follow the enemy’s chest and shift toward the attacker. Starbursts, warm halos, and expanding rings obscure the contact.
Spark counts increase fourfold: 120 for light, 216 for heavy, and 360 for special hits.
The bounded pools hold 4,096 sparks and 768 blood droplets. Returning to golf clears the effects.

## Verification

- Six focused unit and asset tests pass.
- The actual Closer tunic receives correction across 186 sampled poses: ready, three light attacks, heavy, and golf.
- The garment test excludes trousers and checks corrected vertices within 0.1 mm of the fitted thigh constraint.
- Nine rendered Closer poses show the panel covering the thigh, including the ready stance.
- The muted gameplay check renders heavy impacts, verifies all six portrait cells, and checks running after an attack.
- Ten active recordings decode. The silent heavy-hit render peaks below full scale.
- The production build passes. Normal gameplay input triggers a visible, decoded Closer portrait at full opacity.
- A 64-enemy moving forest test averages 58.88 FPS at 1440 × 900, Balanced, on this M1 Max.
  Its 95th-percentile frame time is 16.8 ms. This result does not predict other hardware.

Private review evidence lives under `artifacts/reviews/combat-corrections/` in the primary checkout.
The production regression runs with `node tests/browser-musou-production.mjs URL OUTPUT_DIRECTORY` after building.

## References and limits

[SW4 musou compilation](https://www.youtube.com/watch?v=JVnRHw9frGY) and
[SW5 musou compilation](https://www.youtube.com/watch?v=IkA8oEUrSX8) informed the broad flashes, energy trails, and portrait composition.
Video streaming failed. The review used available storyboard frames, not successful continuous playback.

[Iwan “qubodup” Gabovitch’s Impact recordings](https://opengameart.org/content/impact) supply the new flesh sounds under CC0.
The exact source names and license links are in `public/audio/combat/CREDITS.md`.
Audio testing remained silent. Decode and level checks do not establish subjective sound quality.

The musou face is a dedicated portrait cutaway. It does not replace the gameplay model’s face texture.
Cloth uses fitted thigh constraints rather than full cloth simulation. The game remains a playable alpha.
