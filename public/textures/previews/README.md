These JPEG previews derive from the adjacent original textures. See `../SOURCES.json` for their sources and licenses.

The browser loads these 1024-pixel previews first. It then replaces them with the original full-resolution images in the background.

Regenerate them with `python3 tools/build-surface-previews.py` after changing an original. The generator requires Pillow. CI uses the checked-in files.

The manifest records source hashes and image dimensions. Tests reject stale previews. Normal maps use RGB JPEG without chroma subsampling.
