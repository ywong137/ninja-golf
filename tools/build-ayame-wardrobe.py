"""Build the approved House Advantage garment without changing native animation data."""
import argparse, json, math, pathlib, sys
import bpy, bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--input',required=True);p.add_argument('--output',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
out=pathlib.Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.input)
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.animation_data_clear()
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
body=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups)
for o in list(bpy.data.objects):
 if o.type=='MESH' and not o.vertex_groups and o.name=='Icosphere':bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()

def fabric(name,color,rough=.63,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes;links=m.node_tree.links
 s=n.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Roughness'].default_value=rough;s.inputs['Metallic'].default_value=metal
 if not metal:
  tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=470;tex.inputs['Detail'].default_value=2
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.14;bump.inputs['Distance'].default_value=.00035;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],s.inputs['Normal'])
 return m
black=fabric('Hostile Takeover charcoal woven coat',(.056,.018,.045))

def attach(mesh,name,material):
 ob=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(material)
 return ob
def weight(ob):
 groups={b.name:ob.vertex_groups.new(name=b.name) for b in rig.data.bones}
 for v in ob.data.vertices:
  z=v.co.z;x=v.co.x
  if z<.95:
   thigh='thigh_l' if x>0 else 'thigh_r';w=min(.7,max(0,(.95-z)*1.7));pairs={'pelvis':1-w,thigh:w}
  elif z<1.15:
   w=max(0,min(1,(z-.97)/.18));pairs={'pelvis':1-w,'spine_01':w}
  elif z<1.32:
   w=(z-1.15)/.17;pairs={'spine_01':1-w,'spine_02':w}
  else:pairs={'spine_03':1}
  if z>.97 and 'source_bvh' in globals():
   near=source_bvh.find_nearest(v.co)
   if near[2] is not None:
    face=body.data.polygons[near[2]]
    nearest=sorted(face.vertices,key=lambda i:(source_positions[i]-v.co).length_squared)[:3]
    blends=[1/max(.0001,(source_positions[i]-v.co).length_squared) for i in nearest];total=sum(blends);pairs={}
    for i,factor in zip(nearest,blends):
     for g in body.data.vertices[i].groups:
      name=body.vertex_groups[g.group].name
      if name in groups:pairs[name]=pairs.get(name,0)+g.weight*factor/total
  for name,w in pairs.items():
   if w>0:groups[name].add([v.index],w,'REPLACE')
 ob.parent=rig;mod=ob.modifiers.new('Shared body rig','ARMATURE');mod.object=rig

# Keep original topology, normals and skin weights. The tailored coat extends
# the existing torso with new split tails and a raised collar.
cloth=body.data.materials[0].copy();cloth.name='Wardrobe body fabric'
for n in cloth.node_tree.nodes:
 if n.type=='TEX_IMAGE' and n.image and 'color' in n.image.name.lower():
  n.image=bpy.data.images.load(str(pathlib.Path(__file__).resolve().parents[1]/'assets/wardrobe/house-advantage'/'house-advantage-atlas.png'))
 if n.type=='NORMAL_MAP':n.inputs['Strength'].default_value=.32
# Added garment meshes have no baked vertex colors. Connect their atlas directly.
color_node=next(n for n in cloth.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and ('atlas' in n.image.name))
cloth.node_tree.links.new(color_node.outputs['Color'],cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
index=len(body.data.materials);body.data.materials.append(cloth)
uv=body.data.uv_layers.active
for face in body.data.polygons:
 if face.material_index!=0:continue
 center=sum((uv.data[i].uv for i in face.loop_indices),Vector((0,0)))/len(face.loop_indices)
 hand=center.y>.72 and (center.x<.195 or center.x>.805)
 if not hand:face.material_index=index

def surface(name,rows,material,wrap=False):
 verts=[p for row in rows for p in row];cols=len(rows[0]);faces=[]
 for r in range(len(rows)-1):
  for c in range(cols if wrap else cols-1):faces.append((r*cols+c,r*cols+(c+1)%cols,(r+1)*cols+(c+1)%cols,(r+1)*cols+c))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bm.normal_update()
 for face in bm.faces:
  c=face.calc_center_median()
  if face.normal.dot(Vector((c.x,c.y,0)))<0:face.normal_flip()
 bm.to_mesh(mesh);bm.free();mesh.update()
 ob=attach(mesh,name,material)
 for face in mesh.polygons:face.use_smooth=True
 weight(ob);solid=ob.modifiers.new('Cloth thickness','SOLIDIFY');solid.thickness=.0025;solid.offset=-1
 return ob

source_positions=[body.matrix_world@v.co for v in body.data.vertices]
source_bvh=BVHTree.FromPolygons(source_positions,[list(p.vertices) for p in body.data.polygons])
def fitted_radius(sign,angle,z):
 direction=Vector((sign*math.sin(angle),-math.cos(angle),0));center=Vector((0,.005,z))
 hit,normal,_,_=source_bvh.ray_cast(center+direction*.34,-direction,.34)
 return (hit-center).length+.004 if hit is not None else .195

# Short overlapping jacket panels follow the hips, with side slits.
for sign in [-1,1]:
 rows=[]
 for j in range(12):
  t=j/11;row=[]
  for k in range(29):
   theta=.06+(math.pi-.12)*k/28;z=1.05-t*(.19+.025*math.cos(theta));r=fitted_radius(sign,theta,z)+.008
   row.append((sign*r*math.sin(theta),.005-r*math.cos(theta),z))
  rows.append(row)
 panel=surface('Wardrobe wrap jacket hem '+str(sign),rows,cloth);layer=panel.data.uv_layers.new(name=body.data.uv_layers.active.name)
 for f in panel.data.polygons:
  for li in f.loop_indices:
   vi=panel.data.loops[li].vertex_index;r=vi//29;c=vi%29;layer.data[li].uv=(.43+c/28*.16,.42-r/11*.15)
# A short mandarin collar, open at the throat.
for sign in [-1,1]:
 rows=[]
 for j in range(5):
  t=j/4;rows.append([(sign*(.052+.004*t)*math.sin(theta),.005-(.054+.004*t)*math.cos(theta),1.416+.038*t) for theta in [.28+2.7*k/24 for k in range(25)]])
 collar=surface('Wardrobe mandarin collar '+str(sign),rows,black)
 # The jacket collar follows the upper chest with a small neck contribution.
 # Facial skin weights from nearest-surface fitting do not belong on clothing.
 collar.vertex_groups.clear()
 for name,amount in [('spine_03',.75),('neck_01',.25)]:
  group=collar.vertex_groups.new(name=name);group.add(list(range(len(collar.data.vertices))),amount,'REPLACE')
# Lilac wrap sash.
sash=fabric('Lilac woven sash',(.28,.12,.25),.68)
rows=[]
for j in range(5):
 z=1.012+j*.010;row=[]
 for k in range(65):
  theta=2*math.pi*k/64;sign=1 if math.sin(theta)>=0 else -1;r=fitted_radius(sign,math.acos(math.cos(theta)),z)+.014
  row.append((r*math.sin(theta),.005-r*math.cos(theta),z))
 rows.append(row)
surface('Wardrobe lilac sash',rows,sash)
# One loose sash end adds the asymmetric costume silhouette.
rows=[]
for j in range(13):
 t=j/12;z=1.04-.23*t;theta=.75+.15*t;r=fitted_radius(1,theta,z)+.021
 center=Vector((r*math.sin(theta),.005-r*math.cos(theta),z));across=Vector((math.cos(theta),math.sin(theta),0))*.021
 rows.append([tuple(center-across),tuple(center+across)])
surface('Wardrobe sash end',rows,sash)
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
 if ob.type in {'MESH','ARMATURE'}:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'ayame-wardrobe-source.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
# Restore a relaxed presentation pose after constructing all rest-space cloth.
for side,sign in [('r',-1),('l',1)]:
 bone=rig.pose.bones['upperarm_'+side];pivot=bone.head.copy();bone.matrix=Matrix.Translation(pivot)@Matrix.Rotation(sign*math.radians(27),4,'Y')@Matrix.Translation(-pivot)@bone.matrix
bpy.context.view_layer.update()
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('Wardrobe studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.34,.36,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor';floor.data.materials.append(fabric('Warm grey studio',(.23,.24,.245),.9))
for pos,power,size in [((3,-4,5),550,4),((-3,-1,3),420,3),((1,3,4),700,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.5,-6,2.25));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.94))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.12;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'ayame-wrap-study.png');scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.45
bpy.ops.wm.save_as_mainfile(filepath=str(out/'ayame-wrap-study.blend'));bpy.ops.render.render(write_still=True)
print('WARDROBE_STUDY',json.dumps({'blend':str(out/'ayame-wrap-study.blend'),'render':str(out/'ayame-wrap-study.png'),'publicAssetsChanged':False}))
