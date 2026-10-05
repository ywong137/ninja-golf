"""Build two shared-texture boulders from the CC0 Namaqualand Boulders 01 scan.

Blender: --background --python tools/build-desert-boulders.py -- SOURCE_GLTF
The source may use re-encoded JPEG maps: 4K color, 2K normal/ARM, quality 88.
Each complete source rock retains its own UVs, with two distance levels.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1 or not Path(args[0]).is_file():
    raise SystemExit('Pass the verified Namaqualand Boulders 01 glTF source file.')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args[0])
rocks = sorted((o for o in bpy.context.scene.objects if o.type == 'MESH'), key=lambda o: o.name)
if len(rocks) != 2:
    raise RuntimeError('Expected the two complete source rocks.')
report = []
for index, rock in enumerate(rocks):
    bpy.ops.object.select_all(action='DESELECT')
    rock.select_set(True)
    bpy.context.view_layer.objects.active = rock
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    points = [Vector(v) for v in rock.bound_box]
    lo = Vector(tuple(min(p[k] for p in points) for k in range(3)))
    hi = Vector(tuple(max(p[k] for p in points) for k in range(3)))
    center = (lo + hi) / 2
    center.z = lo.z
    for vertex in rock.data.vertices:
        vertex.co = (vertex.co - center) * (3 / (hi.z - lo.z))
    source = rock.data.copy()
    for lod, budget in [(0, 25000), (1, 3200)]:
        mesh = rock if lod == 0 else rock.copy()
        mesh.data = source.copy()
        if lod:
            bpy.context.collection.objects.link(mesh)
        mesh.name = f'LOD{lod}_desert_boulder_{index}'
        mesh['rockForm'] = index
        bpy.context.view_layer.objects.active = mesh
        if len(mesh.data.polygons) > budget:
            dec = mesh.modifiers.new('Bounded distance detail', 'DECIMATE')
            dec.ratio = budget / len(mesh.data.polygons)
            dec.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=dec.name)
        mesh.data.validate(verbose=True, clean_customdata=True)
        mesh.data.update()
        for face in mesh.data.polygons:
            face.use_smooth = True
        report.append({'form': index, 'lod': lod, 'triangles': len(mesh.data.polygons)})
output = root / 'public/models/nature/desert-boulders.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_extras=True,
                         export_animations=False, export_yup=True, export_image_format='AUTO')
print('DESERT_BOULDERS', json.dumps({'source': 'namaqualand_boulders_01', 'height': 3, 'levels': report}), flush=True)
