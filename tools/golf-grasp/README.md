# Reviewed Ace golf grasp

`ace.json.gz` contains the accepted native rotation curves and the matching grip profiles.
It changes eight arm channels in `Golf_Address`, `Golf_Swing`, and `Golf_Putt`.
The record also stores source and output hashes.

Extract the source assets from commit `d3ea945bc7bff9b73f33e49d8e7e06f86aec66cb` before rebuilding:

```sh
git show d3ea945:public/models/kaede.glb > /tmp/ace-grasp-source.glb
git show d3ea945:src/grip-data.json > /tmp/ace-grasp-source.json
node tools/bake-ace-golf-grasp.mjs \
  --model-source /tmp/ace-grasp-source.glb \
  --grip-source /tmp/ace-grasp-source.json \
  --output-dir /tmp/ace-grasp-rebuild
```

Use a new output directory. The tool rejects existing directories and writes outside `public/` and `src/`.
Install both output files together after review.
Recalculate the preview bounds whenever the model changes.

Expected output hashes:

- `kaede.glb`: `d3d7705b1d04dca302a19f6ba4004edfa13f4c32be3b6882a3cc5e2b7febc39f`
- `grip-data.json`: `5bc2b8d703394ad809457bf9d06420a7ca5b23c548137c5fdd2b898b14fdb76b`

The native arm fit preserves the existing club path and uses calibrated elbow hinges, forearm twist, and limited wrist rotation.
The finger fit uses the actual skinned surfaces. The final thumb uses positive MCP and IP flexion.
The review checked the complete pair, including the finite handle ends and mutual digit clearance.

See [the visual review](../../docs/reviews/ace-golf-grasp.md) for results and remaining limits.
