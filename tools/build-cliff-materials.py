"""Encode the verified Poly Haven Cliff Side color and normal maps for the game.

Supply a directory containing cliff-files.json and the two original source JPGs.
This tool runs offline. It requires Pillow.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'public/textures')
    args = parser.parse_args()
    manifest = json.loads((args.source_dir / 'cliff-files.json').read_text())
    images = []
    for kind, key in [('color', 'Diffuse'), ('normal', 'nor_gl')]:
        original = args.source_dir / f'cliff-{kind}-source.jpg'
        if hashlib.md5(original.read_bytes()).hexdigest() != manifest[key]['2k']['jpg']['md5']:
            raise ValueError(f'{original}: source checksum mismatch')
        with Image.open(original) as image:
            if image.size != (2048, 2048):
                raise ValueError(f'{original}: expected a 2048-square map')
            images.append((kind, image.convert('RGB')))
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for kind, image in images:
        target = args.output_dir / f'sandstone-{kind}-2k.jpg'
        image.save(target, quality=90, subsampling=0)
        print(f'{target}: {target.stat().st_size:,} bytes')

if __name__ == '__main__':
    main()
