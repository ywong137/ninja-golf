# Ace shoulder release curves

These curves lower the lead shoulder slightly during the golf release. Both hands move through one rigid transform around the clubface contact point.

The correction starts after contact at 1.4 seconds. It reaches half strength at 1.471 seconds and ends at 1.651 seconds. It changes eight arm rotation tracks. It preserves the body tracks, geometry, fingers, equipment fit, and other animations.

The solver uses fixed elbow directions and native signed hinges. The correction window uses a regular 960 Hz grid. Original keys remain outside that window. This removes the inconsistent solutions that appeared when fitting closely spaced source keys independently.

Rebuild from the recorded source:

```sh
git show 2c65f92:public/models/kaede.glb > /tmp/ace-shoulder-source.glb
node tools/bake-golf-shoulder.mjs --input /tmp/ace-shoulder-source.glb --output /tmp/ace-shoulder-rebuilt.glb
```

The baker verifies the source and output hashes. It refuses to overwrite a file or write into `public/`.

This is a limited correction. The shoulder surface still has an angular ridge in side views. The remaining arm and chest intersections need further work.
