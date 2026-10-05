"""Restore source opacity to embedded plant textures without changing mesh data."""
import argparse, io, json, struct
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('model', type=Path)
parser.add_argument('mask', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
raw = args.model.read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+size])
data = raw[28+size:]
alpha_images = set()
for mat in doc['materials']:
    if mat.get('alphaMode', 'OPAQUE') == 'OPAQUE':
        continue
    tex = mat['pbrMetallicRoughness']['baseColorTexture']['index']
    alpha_images.add(doc['textures'][tex]['source'])
if not alpha_images:
    raise ValueError('The model has no alpha material.')
for mat in doc['materials']:
    if mat.get('alphaMode', 'OPAQUE') != 'OPAQUE':
        continue
    tex = mat.get('pbrMetallicRoughness', {}).get('baseColorTexture')
    if tex and doc['textures'][tex['index']]['source'] in alpha_images:
        raise ValueError('The opacity texture also serves an opaque material.')
image_views = {doc['images'][i]['bufferView']: doc['images'][i] for i in alpha_images}
mask = Image.open(args.mask).convert('L')
output = bytearray()
for index, view in enumerate(doc['bufferViews']):
    at = view.get('byteOffset', 0)
    chunk = data[at:at+view['byteLength']]
    if index in image_views:
        color = Image.open(io.BytesIO(chunk)).convert('RGBA')
        color.putalpha(mask.resize(color.size, Image.Resampling.LANCZOS))
        stream = io.BytesIO()
        color.save(stream, 'PNG', optimize=True)
        chunk = stream.getvalue()
        image_views[index]['mimeType'] = 'image/png'
    view['byteOffset'] = len(output)
    view['byteLength'] = len(chunk)
    output.extend(chunk)
    output.extend(b'\0' * (-len(output) % 4))
doc['buffers'][0]['byteLength'] = len(output)
header = json.dumps(doc, separators=(',', ':')).encode()
header += b' ' * (-len(header) % 4)
result = struct.pack('<III', 0x46546c67, 2, 28+len(header)+len(output))
result += struct.pack('<II', len(header), 0x4e4f534a) + header
result += struct.pack('<II', len(output), 0x004e4942) + output
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(result)
print(json.dumps({'model': args.model.name, 'images': len(alpha_images), 'before': len(raw), 'after': len(result)}))
