# Sora forehead correction

`sora-forehead.png` preserves the decoded 2048 × 2048 head diffuse texture from Microsoft's Rocketbox `f012` character. The source carries the MIT license: https://github.com/microsoft/Microsoft-Rocketbox.

On 2026-09-27, ImageGen produced a candidate with slightly shorter central bangs. The prompt required the original UV layout and unchanged facial features. The generated image changed unrelated pixels and resolution, so the full image was rejected.

The final texture uses only a small, feathered forehead patch from that candidate. It preserves all original decoded pixels outside x897–1151, y466–563. The patch changes 18,049 pixels. The eyes, nose, mouth, ears, and other UV islands remain unchanged. A front and oblique portrait comparison confirmed the same identity and useful inner-brow exposure.

Patch preparation resized the generated image to 2048 × 2048 with Lanczos sampling. Its mask used these polygon vertices, followed by a five-pixel Gaussian feather:

```
906,531 926,514 965,489 1012,478 1036,478
1083,489 1122,514 1142,531 1122,554 926,554
```

The retained source texture SHA-256 is `4c043250c49439fdbee129d8f7f887a624bab03cdfcc52ee547c54a6768a0c5d`.

`tools/adjust-sora-fringe.mjs` applies the matching four-millimeter central hair-card lift. It changes ten seam-paired vertices, fixes the upper attachments, and tapers the displacement toward the sides. The tool rejects an unknown or already-patched mesh.

Full character exports apply this correction after native golf authoring. Animation-only exports preserve it. The tool appends the PNG and updates the image reference; it preserves every animation payload, UV, skin weight, and index. The original embedded JPEG remains in the binary to avoid shifting existing payloads.

Local review artifacts:

- `/tmp/sora-fringe-texture-before-after.png`: accepted front and oblique comparison.
- `/tmp/sora-fringe-texture.glb`: review candidate, not the integration source.
- `/tmp/bake-sora-forehead.py`: local patch preparation.
- Generated source: `/Users/yishan/.codex/generated_images/01a0e163-d5c9-77c0-8140-6511148b9082/exec-3fe88d49-bf96-4ce1-b770-75cbabc3f380.png`.
