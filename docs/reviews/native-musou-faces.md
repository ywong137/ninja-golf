# Native musou faces

The close-up now changes the actual facial mesh on all six heroes. It narrows the eyes, lowers the brows, and exposes the teeth. The opening artwork fades out before the final native close-up. A clear area in the cinematic background keeps the face bright. The attack title sits below the mouth.

The targets derive from the official Microsoft Rocketbox `*_facial.fbx` files. These files include the Headbox FACS shapes under the repository's MIT license. The project uses the model data, without importing the Headbox Unity demo or its separate dependencies.

Sources:

- [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox)
- [MIT license](https://github.com/microsoft/Microsoft-Rocketbox/blob/master/LICENSE.md)
- [Female Adult 12 facial source](https://github.com/microsoft/Microsoft-Rocketbox/blob/master/Assets/Avatars/Adults/Female_Adult_12/Export/Female_Adult_12_facial.fbx)
- [Headbox documentation](https://github.com/openVRlab/Headbox)

The six source identities are Male Adult 10, 09, 05 and Female Adult 03, 08, 12. Each target uses exact source UV correspondence. The transfer adds deltas to the existing mesh. It preserves Ethan's accepted head, hair, glasses, textures, and neutral expression. All original GLB binary buffers remain byte-identical. Costume targets contain only zero displacement.

The combined expression uses BrowLowerer 0.42, LidTightener 0.60, NoseWrinkler 0.60, UpperLipRaiser 0.70, LowerLipDepressor 0.45, and JawDrop 0.10. Shinobi uses BrowLowerer 0.60 because his brow shape gives a weaker scowl. A bounded correction reduces local displacement where triangles would fold. It checks the complete interpolation interval and keeps coincident seam vertices together. It changes 12 Ethan vertices and 15 Hustler vertices. Other faces need no such correction.

`FacialPose` blends the target on the real cinematic clock. It does not stack the previous bone frown onto the new target. Gaze and normal exertion still use the facial bones. Restoring the overlay also restores every morph weight. Golf, dodge, and death therefore retain their original face state.

Validation includes:

- Neutral, partial, and full target geometry on all six faces.
- Separate visibility checks for both eyes and zero reversed face triangles.
- Exact restoration of the neutral surface and unchanged costume geometry.
- Actual musou camera, target weights, attack transition, and weapon visibility.
- Front and quarter renders, plus the actual cinematic at 1440 × 900.
- An independent Opus 5.5 High review accepted the direction and retained identities.

The intended squint leaves approximately 67–78% of the neutral eye aperture. This differs from the old gentle bone overlay, which kept nearly all of it. The orbital depth check stays below 0.8 mm. Local mesh resolution limits exact eyelid contact. Sora's fringe hides part of her brow, so her expression reads as a sneer. These remain the same characters; the work does not replace their accepted likenesses.

Reproduction:

```bash
blender -b --python tools/extract-rocketbox-facs.py -- \
  --input Female_Adult_12_facial.fbx --output sora-facs.json
node tools/append-musou-facial-target.mjs \
  --identity sora --input sora-before-facs.glb \
  --source sora-facs.json --output sora-candidate.glb
```

Use the model before this target was added. The tool refuses an existing morph target and refuses to overwrite its input.

The built-game check verified all nine model files, two portrait atlases, and ten combat recordings against the release files. It completed all six selections and a golf-to-combat transition without browser errors. The cinematic camera check passed nine scenarios at all three quality settings. A muted 64-enemy musou test averaged 57.3 FPS at 1440 × 900 on an Apple M1 Max. This measures one local scene, not a cross-device performance guarantee.
