"""Build the two regional color maps from the recorded Sentinel scenes.

Use --source-dir to encode previously cropped THEME-raw.png images offline.
Use --browser-headers for ranged downloads with the web-retrieval header policy.
The header file must contain the current Chrome User-Agent and browser headers.
Dependencies: numpy, Pillow; remote crops additionally need rasterio and scipy.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def crop_scene(record, header_file):
    import rasterio
    from rasterio.vrt import WarpedVRT
    from rasterio.transform import from_bounds
    from rasterio.enums import Resampling
    from scipy.ndimage import distance_transform_edt

    size = record['size']
    result = np.zeros((3, size, size), dtype=np.uint8)
    with rasterio.Env(GDAL_HTTP_HEADER_FILE=str(header_file.resolve()),
                      GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',
                      CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
                      GDAL_HTTP_MAX_RETRY='2', GDAL_HTTP_TIMEOUT='40', GDAL_CACHEMAX=128):
        for item in record['items']:
            with rasterio.open(item['source']) as source:
                with WarpedVRT(source, crs='EPSG:4326',
                               transform=from_bounds(*record['bounds'], size, size),
                               width=size, height=size, resampling=Resampling.bilinear) as view:
                    data = view.read()
                    valid = np.any(data > 0, axis=0)
                    empty = ~np.any(result > 0, axis=0)
                    result[:, valid & empty] = data[:, valid & empty]
    missing = ~np.any(result > 0, axis=0)
    # Isolated black source pixels are permitted. Partial swaths are rejected.
    if missing.sum() >= 100:
        raise ValueError(f"{record['theme']}: {missing.sum()} missing pixels; select a complete scene")
    if missing.any():
        nearest = distance_transform_edt(missing, return_distances=False, return_indices=True)
        result[:, missing] = result[:, nearest[0, missing], nearest[1, missing]]
    return Image.fromarray(np.moveaxis(result, 0, 2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--source-dir', type=Path, help='Directory containing THEME-raw.png crops')
    source.add_argument('--browser-headers', type=Path, help='Current browser HTTP headers, one per line')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'public/terrain')
    args = parser.parse_args()
    if args.browser_headers:
        if 'User-Agent: Mozilla/5.0' not in args.browser_headers.read_text():
            parser.error('--browser-headers must include the current Chrome User-Agent')
    records = json.loads((ROOT / 'public/terrain/IMAGERY.json').read_text())
    elevations = json.loads((ROOT / 'public/terrain/SOURCES.json').read_text())
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for record in records:
        elevation = next(r for r in elevations if r['theme'] == record['theme'])
        if record['bounds'] != elevation['bounds']:
            raise ValueError(f"{record['theme']}: imagery and elevation bounds do not match")
        image = (Image.open(args.source_dir / (record['theme'] + '-raw.png')).convert('RGB')
                 if args.source_dir else crop_scene(record, args.browser_headers))
        if image.size != (record['size'], record['size']):
            raise ValueError(f"{record['theme']}: expected a {record['size']} square image")
        target = args.output_dir / record['file']
        image.save(target, quality=91, subsampling=0, optimize=True)
        data = target.read_bytes()
        record['sha256'] = hashlib.sha256(data).hexdigest()
        record['bytes'] = len(data)
        print(f'{target.name}: {len(data):,} bytes')
    (args.output_dir / 'IMAGERY.json').write_text(json.dumps(records, indent=2) + '\n')


if __name__ == '__main__':
    main()
