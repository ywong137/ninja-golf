"""Build a compact dry shrub from Poly Haven's CC0 Didelta spinosa scan.

Blender: --background --python tools/build-desert-scrub.py -- SOURCE_DIRECTORY
Prepare color-alpha.png by merging the verified diffuse and alpha source maps.
The medium source plant retains its branch structure in both distance meshes.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1:
    raise SystemExit('Pass the directory containing didelta_spinosa.gltf and color-alpha.png.')
source = Path(args[0])
gltf = json.loads((source / 'didelta_spinosa.gltf').read_text())
gltf['nodes'] = [next(n for n in gltf['nodes'] if n['name'] == 'didelta_spinosa_medium_LOD0')]
gltf['scenes'] = [{'nodes': [0]}]
gltf['scene'] = 0
material = gltf['materials'][0]
material.update(alphaMode='MASK', alphaCutoff=.3)
texture = material['pbrMetallicRoughness']['baseColorTexture']['index']
gltf['images'][gltf['textures'][texture]['source']]['uri'] = 'color-alpha.png'
selected = source / 'selected.gltf'
selected.write_text(json.dumps(gltf))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(selected))
selected.unlink()
plant = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = plant
plant.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
points = [Vector(v) for v in plant.bound_box]
lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
center = (hi + lo) / 2
center.z = lo.z
scale = 1.5 / (hi.z - lo.z)
for vertex in plant.data.vertices:
    vertex.co = (vertex.co - center) * scale
# Start each level from the complete source so the far level does not compound errors.
original = plant.data.copy()
report = []
for lod, budget in [(0, 22000), (1, 10000)]:
    mesh = plant if lod == 0 else plant.copy()
    mesh.data = original.copy()
    if lod:
        bpy.context.collection.objects.link(mesh)
    mesh.name = f'LOD{lod}_desert_scrub'
    bpy.context.view_layer.objects.active = mesh
    modifier = mesh.modifiers.new('Bounded browser detail', 'DECIMATE')
    modifier.ratio = min(1, budget / len(mesh.data.polygons))
    modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    mesh.data.validate(verbose=True, clean_customdata=True)
    mesh.data.update()
    for face in mesh.data.polygons:
        face.use_smooth = True
    report.append({'lod': lod, 'triangles': len(mesh.data.polygons)})
bpy.ops.object.select_all(action='SELECT')
output = root / 'public/models/nature/desert-scrub.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', use_selection=True,
                         export_animations=False, export_yup=True, export_image_format='AUTO')
print('DESERT_SCRUB', json.dumps({'source': 'didelta_spinosa_medium_LOD0', 'height': 1.5, 'levels': report}), flush=True)
