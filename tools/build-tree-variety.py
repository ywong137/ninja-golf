"""Blender: preserve authored conifer LOD anatomy and export bounded game models.

Run after download-nature.py plus native .blend/alpha downloads described in
 nature-variety.md. Existing game assets remain untouched.
"""
import bpy,sys,json,bmesh,random
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path('/private/tmp/ninja-nature-sources');OUT=ROOT/'public/models/nature'
SPECS={
 'pine-open':('pine_tree_01','pine_tree_01_a_LOD2',17),
 'pine-young':('pine_tree_01','pine_tree_01_b_LOD2',12),
 'fir-layered':('fir_tree_01','fir_tree_01_a_LOD2',19),
 'woody-scrub':('searsia_burchellii','searsia_burchellii_small_LOD0',1.5),
}
selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SPECS)
report=json.loads((OUT/'variety-build.json').read_text()) if (OUT/'variety-build.json').exists() else []
report=[entry for entry in report if entry['name'] not in selected]
for name in selected:
 asset,node,height=SPECS[name];folder=SOURCE/asset;bpy.ops.wm.read_factory_settings(use_empty=True)
 if name=='woody-scrub':
  path=folder/(asset+'.gltf');data=json.loads(path.read_text());data['nodes']=[next(o for o in data['nodes'] if o.get('name')==node)];data['scenes']=[{'nodes':[0]}];data['scene']=0
  temp=folder/'selected.gltf';temp.write_text(json.dumps(data));bpy.ops.import_scene.gltf(filepath=str(temp));objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];temp.unlink()
 else:
  with bpy.data.libraries.load(str(folder/'source.blend'),link=False) as (data_from,data_to):data_to.objects=[node]
  objects=data_to.objects
  for o in objects:bpy.context.collection.objects.link(o)
 for o in objects:
  # Geometry Nodes stores source UVs as a vector attribute, not a UV layer.
  attribute=o.data.attributes.get('UVMap')
  if attribute and not o.data.uv_layers:
   values=[tuple(value.vector) for value in attribute.data];domain=attribute.domain
   o.data.attributes.remove(attribute);uv=o.data.uv_layers.new(name='UVMap')
   for loop in o.data.loops:uv.data[loop.index].uv=values[loop.vertex_index if domain=='POINT' else loop.index][:2]
  for attribute in list(o.data.color_attributes):o.data.color_attributes.remove(attribute)
  o.hide_set(False);o.hide_viewport=False;o.hide_render=False;bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
 points=[o.matrix_world@Vector(v) for o in objects for v in o.bound_box];lo=Vector(tuple(min(p[k]for p in points)for k in range(3)));hi=Vector(tuple(max(p[k]for p in points)for k in range(3)));center=(hi+lo)/2;center.z=lo.z;scale=height/(hi.z-lo.z)
 for o in objects:
  for v in o.data.vertices:v.co=(v.co-center)*scale
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT');bpy.ops.object.select_all(action='DESELECT')
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];counts=[]
 for i,o in enumerate(meshes):
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free()
  old=o.data.materials[0];leaf=any(k in old.name for k in ['twig','leaves']);nativeName=old.name.split('.')[0]
  if name!='woody-scrub':
   mat=bpy.data.materials.new(nativeName+' browser');mat.use_nodes=True;nodes=mat.node_tree.nodes;links=mat.node_tree.links;bsdf=nodes.get('Principled BSDF');bsdf.inputs['Roughness'].default_value=.86;bsdf.inputs['Base Color'].default_value=(.16,.12,.075,1)
   # Native needle-card UVs use the source's twig color and alpha atlas.
   for role,suffix in [('color','diff'),('normal','nor_gl'),('alpha','alpha')]:
    if role=='alpha' and not leaf:continue
    textureName=nativeName.replace('_dead_branches','_bark')
    imagePath=folder/'textures'/f'{textureName}_{suffix}_2k.{"png" if role=="alpha" else "jpg"}'
    if not imagePath.exists():continue
    tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(imagePath),check_existing=True)
    size=2048 if leaf else 1024
    if max(tex.image.size)>size:tex.image.scale(size,size)
    if role=='color':links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    elif role=='alpha':tex.image.colorspace_settings.name='Non-Color';links.new(tex.outputs['Color'],bsdf.inputs['Alpha']);mat.surface_render_method='DITHERED'
    else:
     tex.image.colorspace_settings.name='Non-Color';normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.5;links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],bsdf.inputs['Normal'])
   o.data.materials.clear();o.data.materials.append(mat)
  # Preserve all authored near needle cards when possible. Trunks carry the reduction.
  near=(33000 if leaf else 4000 if 'trunk' in nativeName else 3500 if 'bark' in nativeName else 1000) if name!='woody-scrub' else (4500 if 'leaves' in nativeName else 2200 if 'twigs' not in nativeName else 1100)
  far=(4900 if leaf else 900 if 'trunk' in nativeName else 850 if 'bark' in nativeName else 300) if name!='woody-scrub' else (650 if 'leaves' in nativeName else 300 if 'twigs' not in nativeName else 150)
  bpy.context.view_layer.objects.active=o;tri=o.modifiers.new('Explicit triangles','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
  for lod,budget in [(0,near),(1,far)]:
   target=o if lod==0 else o.copy()
   if lod:target.data=o.data.copy();bpy.context.collection.objects.link(target)
   target.name=f'LOD{lod}_{i}';bpy.context.view_layer.objects.active=target
   if name!='woody-scrub' and ('bark' in nativeName or leaf):
    # Collapse can turn the source's branch junctions into large triangular sheets.
    # Keep native near foliage and branches. Middle foliage keeps complete clusters
    # in deterministic spatial order; woody branches retain their largest components.
    if lod:
     bm=bmesh.new();bm.from_mesh(target.data);bm.verts.index_update();remaining=set(bm.verts);components=[]
     for seed in list(bm.verts):
      if seed not in remaining:continue
      remaining.remove(seed);group={seed};stack=[seed]
      while stack:
       vertex=stack.pop()
       for edge in vertex.link_edges:
        other=edge.other_vert(vertex)
        if other in remaining:remaining.remove(other);group.add(other);stack.append(other)
      faces={face for vertex in group for face in vertex.link_faces};components.append((sum(face.calc_area() for face in faces),group,len(faces)))
     kept=0;remove=[]
     if leaf:random.Random(827).shuffle(components)
     else:components.sort(key=lambda item:item[0],reverse=True)
     limit=120000 if leaf else 8500
     for area,group,count in components:
      if kept+count<=limit:kept+=count
      else:remove.extend(group)
     bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(target.data);bm.free()
   else:
    mod=target.modifiers.new('Bounded browser geometry','DECIMATE');mod.ratio=min(1,budget/len(target.data.polygons));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
   counts.append([target.name,len(target.data.polygons)])
  for p in o.data.polygons:p.use_smooth=True
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_image_format='AUTO')
 report.append({'name':name,'source':asset,'sourceObject':node,'height':height,'triangles':counts,'bytes':(OUT/(name+'.glb')).stat().st_size})
 print('TREE_VARIETY',json.dumps(report[-1]),flush=True)
manifest=json.loads((OUT/'SOURCES.json').read_text());known={x['asset'] for x in manifest}
for name in selected:
 asset=SPECS[name][0]
 if asset not in known:manifest.append({'asset':asset,'license':'CC0-1.0','source':'https://polyhaven.com/a/'+asset,'licenseSource':'https://polyhaven.com/license'});known.add(asset)
(OUT/'SOURCES.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'variety-build.json').write_text(json.dumps(report,indent=2)+'\n')
