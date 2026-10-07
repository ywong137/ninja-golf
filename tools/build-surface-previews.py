"""Generate first-screen textures. Full-resolution sources remain unchanged.
Run: python3 tools/build-surface-previews.py
Requires Pillow. Normal maps retain RGB channels without chroma subsampling.
"""
from pathlib import Path
from PIL import Image, ImageFile
import hashlib, json
ImageFile.MAXBLOCK = 32 * 1024 * 1024
root = Path(__file__).resolve().parents[1]
source = root / 'public/textures'
out = source / 'previews'
out.mkdir(exist_ok=True)
manifest = {}
for path in sorted(source.glob('*.jpg')):
    im = Image.open(path)
    if max(im.size) <= 1024:
        continue
    original_size = im.size
    im.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
    # Keep vector and scalar maps free from chroma subsampling artifacts.
    target = out / path.name
    im.save(target, format='JPEG', quality=92, subsampling=0, optimize=True)
    data = target.read_bytes()
    digest = hashlib.sha256(data).hexdigest()[:12]
    name = f'{path.stem}-{digest}.jpg'
    target.rename(out / name)
    manifest[path.name] = dict(file=f'previews/{name}', sourceSHA256=hashlib.sha256(path.read_bytes()).hexdigest(), width=im.width, height=im.height, sourceWidth=original_size[0], sourceHeight=original_size[1], bytes=len(data), originalBytes=path.stat().st_size)
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(manifest)} previews: {sum(v["originalBytes"] for v in manifest.values())/1e6:.1f} MB -> {sum(v["bytes"] for v in manifest.values())/1e6:.1f} MB')
