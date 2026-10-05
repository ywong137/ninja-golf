"""Blender: reduce CC0 scanned nature to bounded browser LODs without replacing its materials."""
import bpy,sys,json,bmesh,runpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];SOURCE=Path('/private/tmp/ninja-nature-sources');OUT=ROOT/'public/models/nature';OUT.mkdir(parents=True,exist_ok=True)
SPECS={
 'island_tree_01':('forest-canopy',14,26000,3800),
 'quiver_tree_01':('dry-tree',7,12000,2200),
 'shrub_01':('understory',1.8,6500,1100),
 'fern_02':('fern',1.0,2200,500),
 'boulder_01':('coastal-rock',3.0,6000,1200),
 'namaqualand_boulder_02':('desert-rock',3.0,6000,1200),
 'coastal_cliff_02':('sea-cliff',15,16000,3500),
}
for asset in sys.argv[sys.argv.index('--')+1:] or SPECS:
 name,height,budget,lowbudget=SPECS[asset]
 bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(SOURCE/asset/(asset+'.gltf')))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 for o in meshes:
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.select_set(False)
 # Imported glTF is converted from Y-up into Blender's Z-up.
 points=[o.matrix_world@Vector(v) for o in meshes for v in o.bound_box];lo=Vector(tuple(min(p[k] for p in points) for k in range(3)));hi=Vector(tuple(max(p[k] for p in points) for k in range(3)));scale=height/(hi.z-lo.z);center=(hi+lo)/2;center.z=lo.z
 for o in meshes:
  for v in o.data.vertices:v.co=(v.co-center)*scale
  bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];total=sum(len(o.data.polygons) for o in meshes)
 for n,o in enumerate(meshes):
  bpy.context.view_layer.objects.active=o
  if asset in ['boulder_01','island_tree_01']:
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free()
  o.name=f'LOD0_{n}';count=len(o.data.polygons)
  target=max(200,int(budget*count/total))
  if asset=='island_tree_01':
   material=o.data.materials[0].name
   if 'leaves' in material:
    # Keep the source leaves here. The UV-based rebuild below simplifies each
    # leaf independently, so no reduction step can remove a whole leaf.
    target=count
   elif 'branches' in material:target=30000
   else:target=10500
  dec=o.modifiers.new('Browser triangle budget','DECIMATE');dec.ratio=min(1,target/count);dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
  for p in o.data.polygons:p.use_smooth=True
  for mat in o.data.materials:
   if not mat or not mat.use_nodes:continue
   node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
   if node:
    node.inputs['Metallic'].default_value=0;node.inputs['Roughness'].default_value=.86
    node.inputs['Specular IOR Level'].default_value=.25
  low=o.copy();low.data=o.data.copy();bpy.context.collection.objects.link(low);low.name=f'LOD1_{n}';bpy.context.view_layer.objects.active=low;mod=low.modifiers.new('Distant geometry','DECIMATE');lowtarget=max(100,int(lowbudget*count/total));
  if asset=='island_tree_01':lowtarget=len(low.data.polygons) if 'leaves' in material else 4000 if 'branches' in material else 1800
  mod.ratio=min(1,lowtarget/len(low.data.polygons));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_animations=False,export_yup=True,export_image_format='AUTO')
 if asset=='island_tree_01':
  saved_args=sys.argv[:]
  try:
   sys.argv=['rebuild-broadleaf.py','--source',str(SOURCE/asset/(asset+'.gltf')),'--model',str(OUT/(name+'.glb')),'--output',str(OUT/(name+'.glb')),'--report',str(OUT/(name+'-build.json'))]
   runpy.run_path(str(ROOT/'tools/rebuild-broadleaf.py'),run_name='__main__')
  finally:sys.argv=saved_args
 print('NATURE',name,'height',height,'triangles',[(o.name,len(o.data.polygons)) for o in bpy.context.scene.objects if o.type=='MESH'],flush=True)
(OUT/'SOURCES.json').write_text(json.dumps([entry for entry in json.loads((SOURCE/'SOURCES.json').read_text()) if entry['asset'] in SPECS],indent=2)+'\n')
