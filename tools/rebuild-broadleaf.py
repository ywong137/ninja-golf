"""Rebuild complete broadleaf foliage with curved near leaves and planar middle leaves."""
import argparse, json, struct, copy
from pathlib import Path
import numpy as np
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--source', type=Path, required=True, help='Original island_tree_01 glTF with its binary buffer')
p.add_argument('--model', type=Path, required=True, help='Existing game GLB; preserves its wood and textures')
p.add_argument('--output', type=Path, required=True)
p.add_argument('--report', type=Path, required=True)
a = p.parse_args()
source = json.loads(a.source.read_text())
binary = (a.source.parent / source['buffers'][0]['uri']).read_bytes()

def read(i):
    accessor = source['accessors'][i]
    view = source['bufferViews'][accessor['bufferView']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2'}[accessor['componentType']]
    size = np.dtype(dtype).itemsize
    return np.ndarray((accessor['count'], width), dtype=dtype, buffer=binary, offset=view.get('byteOffset', 0) + accessor.get('byteOffset', 0), strides=(view.get('byteStride', size * width), size)).copy()
parts = source['meshes'][0]['primitives']
part = next((q for q in parts if source['materials'][q['material']]['name'] == 'island_tree_01_leaves'))
position = read(part['attributes']['POSITION'])
uv = read(part['attributes']['TEXCOORD_0'])
normal = read(part['attributes']['NORMAL'])
indices = read(part['indices']).reshape(-1, 3)
if len(position) % 21 or not np.all(indices // 21 == (indices // 21)[:, :1]):
    raise ValueError('Source must contain separate 21-vertex leaves.')
count = len(position) // 21
position = position.reshape(count, 21, 3)
uv = uv.reshape(count, 21, 2)
normal = normal.reshape(count, 21, 3)
lo = np.minimum.reduce([read(q['attributes']['POSITION']).min(axis=0) for q in parts])
hi = np.maximum.reduce([read(q['attributes']['POSITION']).max(axis=0) for q in parts])
center = (lo + hi) / 2
center[1] = lo[1]
scale = 14 / (hi[1] - lo[1])
uvmin = uv.min(axis=1)
uvmax = uv.max(axis=1)
span = uvmax - uvmin
if np.any(span < 1e-05):
    raise ValueError('Leaf UV range is degenerate.')
uvcenter = (uvmin + uvmax) / 2
uvunit = (uv - uvcenter[:, None, :]) * 2 / span[:, None, :]
u, v = (uvunit[:, :, 0], uvunit[:, :, 1])
basis = np.stack([np.ones_like(u), u, v, u * v, v * v], axis=-1)
# Fit each disconnected leaf in its own UV rectangle. Never merge separate leaves.
coeff = np.linalg.pinv(basis.astype(np.float64)) @ position
residual = (basis @ coeff - position) * scale
errors = np.sqrt(np.mean(np.sum(residual ** 2, axis=-1), axis=1))
if np.quantile(errors, 0.99) > 0.018:
    raise ValueError('Leaf surface fit exceeds 18 mm; inspect source layout.')
raw = a.model.read_bytes()
size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + size])
data = bytearray(raw[28 + size:])
lods = []
if doc.get('skins') or doc.get('animations') or 'EXT_meshopt_compression' in doc.get('extensionsUsed', []):
    raise ValueError('Use the uncompressed static forest-canopy.glb, not an animated or compressed model.')

def add(values, kind, component=5126):
    values = np.asarray(values, dtype='<f4' if component == 5126 else '<u4')
    values = values.reshape(-1, {'VEC2': 2, 'VEC3': 3, 'SCALAR': 1}[kind])
    chunk = values.tobytes()
    view = len(doc['bufferViews'])
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(data), 'byteLength': len(chunk), 'target': 34963 if kind == 'SCALAR' else 34962})
    data.extend(chunk)
    data.extend(b'\x00' * (-len(data) % 4))
    acc = {'bufferView': view, 'componentType': component, 'count': len(values), 'type': kind}
    if kind == 'VEC3':
        acc.update(min=values.min(axis=0).tolist(), max=values.max(axis=0).tolist())
    doc['accessors'].append(acc)
    return len(doc['accessors']) - 1
for level, rows in [(0, [-1.0, 0.0, 1.0]), (1, [-1.0, 1.0])]:
    grid = np.array([(u, v) for v in rows for u in [-1.0, 1.0]])
    u, v = (grid[:, 0], grid[:, 1])
    b = np.stack([np.ones_like(u), u, v, u * v, v * v], axis=-1)
    pos = np.einsum('vf,nfc->nvc', b, coeff)
    pu = coeff[:, None, 1] + coeff[:, None, 3] * v[None, :, None]
    pv = coeff[:, None, 2] + coeff[:, None, 3] * u[None, :, None] + 2 * coeff[:, None, 4] * v[None, :, None]
    norm = np.cross(pu, pv)
    norm /= np.linalg.norm(norm, axis=-1, keepdims=True)
    flip = np.sum(norm.mean(axis=1) * normal.mean(axis=1), axis=-1) < 0
    norm[flip] *= -1
    tex = uvcenter[:, None, :] + grid[None, :, :] * span[:, None, :] / 2
    local = np.array([(j * 2, j * 2 + 1, j * 2 + 2) for j in range(len(rows) - 1)] + [(j * 2 + 1, j * 2 + 3, j * 2 + 2) for j in range(len(rows) - 1)], dtype=np.uint32)
    idx = np.arange(count, dtype=np.uint32)[:, None, None] * len(grid) + local[None, :, :]
    idx[flip] = idx[flip][:, :, ::-1]
    matches = [doc['meshes'][n['mesh']] for n in doc['nodes'] if 'mesh' in n and n.get('name', '').startswith(f'LOD{level}_') and any((doc['materials'][q['material']]['name'] == 'island_tree_01_leaves' for q in doc['meshes'][n['mesh']]['primitives']))]
    if len(matches) != 1 or len(matches[0]['primitives']) != 1:
        raise ValueError(f'Expected one separate leaf mesh for LOD{level}.')
    mesh = matches[0]
    material = mesh['primitives'][0]['material']
    if not np.isfinite(pos).all() or not np.isfinite(norm).all():
        raise ValueError('Leaf fit produced a non-finite surface.')
    mesh['primitives'] = [{'attributes': {'POSITION': add((pos - center) * scale, 'VEC3'), 'NORMAL': add(norm, 'VEC3'), 'TEXCOORD_0': add(tex, 'VEC2')}, 'indices': add(idx, 'SCALAR', 5125), 'material': material, 'mode': 4}]
    lods.append({'lod': level, 'leaves': count, 'triangles': idx.size // 3, 'vertices': count * len(grid)})
# Compact only the obsolete leaf buffers. Preserve wood and image bytes.
used = sorted({i for m in doc['meshes'] for q in m['primitives'] for i in [q.get('indices'), *q['attributes'].values()] if i is not None})
accessor_map = {old: new for new, old in enumerate(used)}
for m in doc['meshes']:
    for q in m['primitives']:
        q['attributes'] = {name: accessor_map[i] for name, i in q['attributes'].items()}
        if 'indices' in q:
            q['indices'] = accessor_map[q['indices']]
doc['accessors'] = [doc['accessors'][i] for i in used]
used_views = sorted({x['bufferView'] for x in doc['accessors']} | {x['bufferView'] for x in doc['images']})
view_map = {old: new for new, old in enumerate(used_views)}
packed = bytearray()
views = []
for i in used_views:
    view = copy.deepcopy(doc['bufferViews'][i])
    off = view.get('byteOffset', 0)
    chunk = data[off:off + view['byteLength']]
    view['byteOffset'] = len(packed)
    views.append(view)
    packed.extend(chunk)
    packed.extend(b'\x00' * (-len(packed) % 4))
for item in [*doc['accessors'], *doc['images']]:
    item['bufferView'] = view_map[item['bufferView']]
doc['bufferViews'] = views
doc['buffers'] = [{'byteLength': len(packed)}]
header = json.dumps(doc, separators=(',', ':')).encode()
header += b' ' * (-len(header) % 4)
a.output.parent.mkdir(parents=True, exist_ok=True)
a.output.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(header) + len(packed)) + struct.pack('<II', len(header), 0x4E4F534A) + header + struct.pack('<II', len(packed), 0x004E4942) + packed)
report = {'sourceLeaves': count, 'sourceTriangles': len(indices), 'fitRmsMetres': {str(q): float(np.quantile(errors, q)) for q in [0.5, 0.95, 0.99, 1]}, 'lods': lods, 'bytes': a.output.stat().st_size, 'sourceCenter': center.tolist(), 'sourceScale': float(scale)}
a.report.parent.mkdir(parents=True, exist_ok=True)
a.report.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
