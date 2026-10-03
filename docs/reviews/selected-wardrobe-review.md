# Selected wardrobe review — 2026-10-03

All six approved default outfits now have model implementations. The concept catalog retains all 18 designs for future unlockables.

The five models in this change add textured clothing geometry. They preserve the existing faces, hair, skeletons, and animation tracks. The binary preservation report and tests verify those claims.

The Ace and Closer use fitted clothing from the licensed f008 body. Their original hands and shoes preserve the established grip and ground contacts. The Ace sleeves use her native arm surface and weights. The Hustler collar follows the chest and neck instead of the facial rig.

## Validation

The initial full unit run covered 939 tests: 917 passed and 22 failed. The failures identified garment fit problems and outdated source comparisons. Corrective runs covered every failure after the changes.

- The focused regression run covered 81 tests. It passed 77 before the last corrections.
- The corrected enemy baseline test passed with all five enemy appearance tests.
- The final eight tests passed. These cover all five asset preservation checks, the Ace leg clearance, and both remaining Hustler clearance failures.
- All six browser previews completed the golf, light attack, and heavy attack cycle without browser errors.
- The browser verified the C console, speed, pause, resume, motion selection, scrubbing, and frame stepping.
- The production build passed. It retains the existing large-bundle warning.

The final Ace rising-attack recovery clears the opposite leg by 16.8 mm. The Hustler golf audit found no arm, hand, or club intersections across 4,161 samples. Her opening attack retains 2.5 mm minimum arm-to-head clearance.

The tests retain their existing anatomical, intersection, and clearance limits. Surface-count fixtures now describe the changed garment topology. The enemy comparison uses its original body primitives, before the playable Shinobi costume split.

## Art and motion limits

These are first 3D costume implementations. The original shoes and the Closer's full-length trousers differ from the concept artwork. The stored concept sheets remain the target for later refinement.

The wardrobe pass does not complete the broader combat animation work. Preserve complete source performances and prioritize body movement, weight transfer, and blade direction. Do not resume frame-by-frame hand tuning while major body movement remains weak.
