"""Build the approved Major Threat garment without changing native animation data."""
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
  n.image=bpy.data.images.load(str(pathlib.Path(__file__).resolve().parents[1]/'assets/wardrobe/major-threat'/'major-threat-fitted-atlas.png'))
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

# The Ace's approved silhouette: cropped vest, real Bermuda hems and knee socks.
body.name='Wardrobe replacement body'
# Crop only the garment islands. Preserve the skin, hair and face primitives.
bm=bmesh.new();bm.from_mesh(body.data);uvlayer=bm.loops.layers.uv.active
for floor,kind in [(.612,'pants'),(.988,'tunic')]:
 def belongs(face):
  if face.material_index!=index:return False
  u=sum(l[uvlayer].uv.x for l in face.loops)/len(face.loops);v=sum(l[uvlayer].uv.y for l in face.loops)/len(face.loops)
  return True if kind=='pants' else (.31<u<.69)
 selected=[f for f in bm.faces if belongs(f)]
 geom=set(selected)
 for f in selected:geom.update(f.edges);geom.update(f.verts)
 bmesh.ops.bisect_plane(bm,geom=list(geom),dist=.000001,plane_co=(0,0,floor),plane_no=(0,0,1),clear_inner=False,clear_outer=False)
 remove=[f for f in bm.faces if belongs(f) and f.calc_center_median().z<floor-.00001 and (kind!='pants' or f.calc_center_median().z>.16)]
 bmesh.ops.delete(bm,geom=remove,context='FACES')
# Remove remaining seam strips below the shorts and old tunic ties.
remove=[]
for f in bm.faces:
 if f.material_index!=index:continue
 c=f.calc_center_median();u=sum(l[uvlayer].uv.x for l in f.loops)/len(f.loops);v=sum(l[uvlayer].uv.y for l in f.loops)/len(f.loops)
 if (.160<c.z<.610):remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES')
bm.to_mesh(body.data);bm.free();body.data.update()
# Tailor the shorts around each native thigh axis. A loose donor thigh touched
# its partner during the existing recovery step; the skeleton stays unchanged.
for v in body.data.vertices:
 z=v.co.z
 if not (.608<z<.91):continue
 side='l' if v.co.x>0 else 'r';hip=rig.data.bones['thigh_'+side].head_local;knee=rig.data.bones['calf_'+side].head_local
 t=(z-knee.z)/(hip.z-knee.z);center=knee.lerp(hip,t);blend=max(0,min(1,(z-.78)/.13));blend=blend*blend*(3-2*blend);factor=.90+.10*blend
 v.co.x=center.x+(v.co.x-center.x)*factor;v.co.y=center.y+(v.co.y-center.y)*factor
body.data.update()
# Refresh the cloth fit surface after the crop.
source_positions=[body.matrix_world@v.co for v in body.data.vertices]
source_bvh=BVHTree.FromPolygons(source_positions,[list(p.vertices) for p in body.data.polygons])
navy=fabric('Major Threat navy knee sock knit',(.013,.025,.057),.84)
pink=fabric('Major Threat dusty pink woven polo',(.52,.21,.28),.76)
cream=fabric('Major Threat warm cream cotton',(.74,.71,.61),.8)
skin=fabric('Major Threat natural knee skin',(.50,.32,.235),.64)
for sign in [-1,1]:
 side='l' if sign>0 else 'r';knee=rig.data.bones['calf_'+side].head_local;ankle=rig.data.bones['foot_'+side].head_local
 def limb_radius(z):
  anchors=[(.09,.034,.047),(.15,.034,.041),(.28,.044,.052),(.37,.049,.057),(.43,.045,.053),(.5,.044,.05),(.55,.049,.059),(.64,.060,.068)]
  for lo,hi in zip(anchors,anchors[1:]):
   if z<=hi[0]:
    t=max(0,min(1,(z-lo[0])/(hi[0]-lo[0])));return(lo[1]*(1-t)+hi[1]*t,lo[2]*(1-t)+hi[2]*t)
  return anchors[-1][1:]
 for label,start,end,material in [('sock',.120,.425,navy),('knee',.424,.618,skin)]:
  rows=[]
  for j in range(13):
   z=start+(end-start)*j/12;t=(z-ankle.z)/(knee.z-ankle.z);center=ankle.lerp(knee,t);rx,ry=limb_radius(z)
   taper=1-.16*max(0,min(1,(z-.58)/.038));rx*=taper;ry*=taper
   row=[]
   for k in range(25):
    theta=math.tau*k/24;ripple=1+.006*math.cos(theta*24) if label=='sock' else 1
    row.append((center.x+rx*math.sin(theta)*ripple,center.y-ry*math.cos(theta)*ripple,z))
   rows.append(row)
  ob=surface('Wardrobe leg '+label+' '+side,rows,material)
  # Lower-leg weights follow the knee and ankle, never the torso.
  ob.vertex_groups.clear();groups={name:ob.vertex_groups.new(name=name) for name in ['thigh_'+side,'calf_'+side,'foot_'+side]}
  for v in ob.data.vertices:
   z=v.co.z;thigh=max(0,min(1,(z-.465)/.10));foot=max(0,min(.8,(.145-z)/.07));calf=1-thigh-foot
   for name,w in [('thigh_'+side,thigh),('calf_'+side,calf),('foot_'+side,foot)]:
    if w>0:groups[name].add([v.index],w,'REPLACE')
  ob.modifiers.remove(ob.modifiers['Cloth thickness'])
  if label=='sock':
   ob.data.materials.append(pink)
   for f in ob.data.polygons:
    z=f.center.z
    if .382<z<.394 or .407<z<.417:f.material_index=1
# Fitted waistband covers the cropped vest seam.
rows=[]
for j in range(5):
 z=.945+j*.012;row=[]
 for k in range(65):
  theta=math.tau*k/64;sign=1 if math.sin(theta)>=0 else -1;r=min(.150,max(.106,fitted_radius(sign,math.acos(math.cos(theta)),1.024)))
  row.append((r*math.sin(theta),.005-r*math.cos(theta),z))
 rows.append(row)
surface('Wardrobe Bermuda waistband',rows,navy)
# Real visor band and curved brim; both follow the existing head joint.
for label in ['band','brim']:
 rows=[]
 for j in range(7):
  t=j/6;row=[]
  for k in range(41):
   theta=(-1.6+3.2*k/40) if label=='brim' else math.tau*k/40
   rx=.092+(.058*t if label=='brim' else 0);ry=.088+(.057*t if label=='brim' else 0)
   z=1.664-.014*t if label=='brim' else 1.664+.030*t
   row.append((rx*math.sin(theta),.028-ry*math.cos(theta),z))
  rows.append(row)
 ob=surface('Wardrobe golf visor '+label,rows,cream);ob.vertex_groups.clear();g=ob.vertex_groups.new(name='neck_01');g.add(list(range(len(ob.data.vertices))),1,'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
 if ob.type in {'MESH','ARMATURE'}:ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(out/'kaede-wardrobe-source.glb'),export_format='GLB',use_selection=True,export_animations=False,export_apply=True,export_extras=True)
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
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(out/'kaede-golf-study.png');scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.45
bpy.ops.wm.save_as_mainfile(filepath=str(out/'kaede-golf-study.blend'));bpy.ops.render.render(write_still=True)
print('WARDROBE_STUDY',json.dumps({'blend':str(out/'kaede-golf-study.blend'),'render':str(out/'kaede-golf-study.png'),'publicAssetsChanged':False}))
