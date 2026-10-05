# Ace shorts and visor — October 5

The user identified oversized shorts and an incorrect visor in the selection view.
The review compares the ready stance, golf swing, light attack, and heavy attack from three angles.

## Shorts

The existing mesh was already fitted. The runtime cloth classifier caused the oversized appearance.
It identified any connected fabric surface ending above the knee as a hanging panel.
The Ace's cropped trousers met that height rule, so collision correction displaced 164 vertices outward.
Disabling that correction exposed the intended fitted shorts immediately.

The shared classifier now checks the hem's skin weights.
A hem that follows the thighs directly is fitted legwear, rather than a free tunic panel.
The Ace retains her original shorts mesh and animation weights.
The Closer's tunic and Ethan's coat retain their existing collision and drape behavior.

## Visor

The previous visor had an oversized brim and followed `neck_01` instead of `Head`.
A first replacement still left a loose ring around the hair. The user correctly rejected that fit.

Photo references:
- [Nike Ace visor, worn side view](https://strungout.com.au/products/nike-ace-dri-fit-visor-black-anthracite-white)
- [Sakura Ishii, front portrait with golf visor](https://www.alba.co.jp/tour/players/22067/)

Both references show a band against the forehead and temples, with a lower strap at the back.
The replacement follows that shape. Its brim curves across the forehead, with narrow navy edges.
The first fitting algorithm used transparent hair strips. Gaps between strips caused an oversized fallback radius.
The final fitter uses the solid head surface, including its scalp, and allows clearance for nearby hair strips.
It fails if a ray misses the solid head instead of inventing a radius.
The complete visor follows the same head joint as the hair and upper face.
The review checks front, rear, side, and three-quarter views, plus golf and attack poses.

`tools/fit-ace-visor.mjs` rebuilds this asset from the saved unfitted input.
It replaces only the visor primitive. The original binary payload remains unchanged.
Seven other geometry primitives, the face, materials, skeleton, and all 43 animation clips remain unchanged.
The visor's new vertices have new head skin weights. Other skin weights remain unchanged.
The model revision is `snug-golf-visor-20261005`.

## Verification

Six focused presentation tests pass.
They sample the Ace's ready stance, golf swing, light attack, heavy attack, and run.
The visor remains fixed relative to the head through those poses.
The shorts receive no hanging-panel displacement.
The same suite checks the Closer's tunic and Ethan's coat throughout their existing movements.
Six selection-bounds checks pass after rebaking the Ace's complete preview bounds.

The private build succeeds as `index-DeuFuDl7.js`, with the existing large-chunk warning.
Review evidence remains in `/Users/yishan/ninja-golf/artifacts/reviews/ace-shorts-2026-10-05/`.
The `snug-clear` directory contains the final studio views. Earlier candidates remain separate for comparison.
The exact private build passed the normal selection, golf shot, and heavy attack flow with no browser errors.
No public files were published. All review browsers use muted audio.
