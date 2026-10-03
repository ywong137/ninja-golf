"""Build the approved Green Keeper garment without changing native animation data."""
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
  n.image=bpy.data.images.load(str(pathlib.Path(__file__).resolve().parents[1]/'assets/wardrobe/green-keeper'/'green-keeper-fitted-atlas.png'))
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
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
 axis=Vector((sum(v[0] for v in verts)/len(verts),sum(v[1] for v in verts)/len(verts),0)) if any(word in name for word in ['leg ','trousers ','shoe ']) else Vector((0,0,0))
 score=sum(f.normal.dot(Vector((f.calc_center_median().x-axis.x,f.calc_center_median().y-axis.y,0)))*f.calc_area() for f in bm.faces)
 if score<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
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

body.name='Wardrobe replacement body'
# Close the round-shirt opening by raising only its neck-edge vertices.
for face in body.data.polygons:
 if face.material_index!=index:continue
 for li in face.loop_indices:
  vi=body.data.loops[li].vertex_index;uv=body.data.uv_layers.active.data[li].uv;v=body.data.vertices[vi]
  if .455<uv.x<.545 and .53<uv.y<.65 and v.co.z>1.35 and abs(v.co.x)<.087:v.co.z=max(v.co.z,1.429)
body.data.update()
cream=fabric('Green Keeper cream woven linen',(.70,.665,.55),.78)
jade=fabric('Green Keeper jade woven panels',(.026,.088,.067),.72)
# A fitted split tunic reaches lower on the white front side.
for sign in [-1,1]:
 rows=[]
 for j in range(15):
  t=j/14;row=[]
  for k in range(33):
   theta=.09+(math.pi-.18)*k/32
   z=1.055-t*(.24+(.08 if sign>0 else 0)*max(0,math.cos(theta)))
   r=fitted_radius(sign,theta,max(.86,z))+.010+.006*t
   row.append((sign*r*math.sin(theta),.005-r*math.cos(theta),z))
  rows.append(row)
 ob=surface('Wardrobe asymmetric tunic '+str(sign),rows,cloth)
 layer=ob.data.uv_layers.new(name=body.data.uv_layers.active.name)
 for f in ob.data.polygons:
  for li in f.loop_indices:
   vi=ob.data.loops[li].vertex_index;r=vi//33;c=vi%33;layer.data[li].uv=(.46+c/32*.15,.9-r/14*.20) if sign>0 else (.385+c/32*.040,.64-r/14*.30)
for sign in [-1,1]:
 rows=[]
 for j in range(6):
  t=j/5;rows.append([(sign*(.059-.003*t)*math.sin(theta),.016-(.059-.003*t)*math.cos(theta),1.431+.032*t) for theta in [.15+2.92*k/24 for k in range(25)]])
 surface('Wardrobe high tunic collar '+str(sign),rows,cream)
rows=[]
for j in range(5):
 z=1.018+j*.009;row=[]
 for k in range(65):
  theta=math.tau*k/64;sign=1 if math.sin(theta)>=0 else -1;r=fitted_radius(sign,math.acos(math.cos(theta)),z)+.012;row.append((r*math.sin(theta),.005-r*math.cos(theta),z))
 rows.append(row)
surface('Wardrobe jade belt',rows,jade)
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
 if ob.type in {'MESH','ARMATURE'}:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'sora-wardrobe-source.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
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
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'sora-tunic-study.png');scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.45
bpy.ops.wm.save_as_mainfile(filepath=str(out/'sora-tunic-study.blend'));bpy.ops.render.render(write_still=True)
print('WARDROBE_STUDY',json.dumps({'blend':str(out/'sora-tunic-study.blend'),'render':str(out/'sora-tunic-study.png'),'publicAssetsChanged':False}))
