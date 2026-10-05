"""Encode a verified USGS 3DEP crop as the desert's elevation grid.

The TIFF must contain 2049 square F32 elevation samples in EPSG:4326.
Its pixel centers must match the existing geographic bounds. Supply the saved
export response and request record to verify coordinates before encoding.
This tool runs offline and does not alter the course scale or playable terrain.
Dependencies: numpy, Pillow.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-tiff', type=Path, required=True)
    parser.add_argument('--export-json', type=Path, required=True)
    parser.add_argument('--request-json', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'public/terrain')
    args = parser.parse_args()
    records = json.loads((ROOT / 'public/terrain/SOURCES.json').read_text())
    previous = next(r for r in records if r['theme'] == 'desert')
    request = json.loads(args.request_json.read_text())
    response = json.loads(args.export_json.read_text())
    size = request['size']
    if size != 2049 or request['bounds'] != previous['bounds']:
        raise ValueError('The crop must preserve the desert bounds with 2049 samples per axis.')
    if response.get('width') != size or response.get('height') != size:
        raise ValueError('USGS did not return the requested grid size.')
    extent = response['extent']
    returned = [extent[k] for k in ['xmin', 'ymin', 'xmax', 'ymax']]
    if not np.allclose(returned, request['exportBounds'], atol=1e-10, rtol=0):
        raise ValueError('The export service adjusted the geographic bounds.')
    with Image.open(args.source_tiff) as image:
        if image.mode != 'F' or image.size != (size, size):
            raise ValueError('Expected a single-band F32 elevation TIFF, not a hillshade image.')
        scale, tie = image.tag_v2[33550], image.tag_v2[33922]
        centers = [tie[3] + scale[0] / 2, tie[4] - scale[1] * (size - .5),
                   tie[3] + scale[0] * (size - .5), tie[4] - scale[1] / 2]
        if not np.allclose(centers, previous['bounds'], atol=1e-9, rtol=0):
            raise ValueError('TIFF pixel centers do not align with the existing terrain and imagery.')
        if extent['spatialReference'].get('latestWkid', extent['spatialReference']['wkid']) != 4326:
            raise ValueError('The export must use geographic EPSG:4326 coordinates.')
        heights = np.array(image)
    if not np.isfinite(heights).all() or heights.min() < 900 or heights.max() > 2500:
        raise ValueError('The crop contains invalid, missing, or out-of-area elevations.')
    grid = np.rint(heights).astype('<i2')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    target = args.output_dir / 'desert-relief.i16'
    target.write_bytes(grid.tobytes())
    result = dict(theme='desert', name=previous['name'], file=target.name, size=size,
                  encoding='int16 little-endian, row-major north to south',
                  bounds=previous['bounds'], spanMetres=previous['spanMetres'],
                  nominalSampleSpacingMetres=previous['spanMetres'] / (size - 1),
                  minMetres=int(grid.min()), maxMetres=int(grid.max()),
                  source=request['url'], sourceService='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
                  attribution='USGS National Map 3D Elevation Program (3DEP). August 25, 2026.',
                  sourceSHA256=hashlib.sha256(args.source_tiff.read_bytes()).hexdigest(),
                  sha256=hashlib.sha256(target.read_bytes()).hexdigest())
    records = [result if r['theme'] == 'desert' else r for r in records]
    (args.output_dir / 'SOURCES.json').write_text(json.dumps(records, indent=2) + '\n')
    print(f'{target}: {size} × {size}, {target.stat().st_size:,} bytes; maximum rounding error {np.max(np.abs(heights-grid)):.3f} m')


if __name__ == '__main__':
    main()
