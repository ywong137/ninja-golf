"""Sculpt Ethan's head and add glasses/hair without changing the native rig or clips.

Run with Blender --background --python tools/build-vice-president.py -- \
  --input public/models/monk.glb --output /tmp/vice-president.glb

The sculpt keeps every body vertex, UV, joint index, weight and animation byte.
It patches positions and normals from Blender and adds head-parented accessories.
Only the generated albedo is distributed. The private photos stay outside the repo.
"""
import argparse, json, math, pathlib, struct, sys
import bpy
from mathutils import Matrix, Quaternion, Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=pathlib.Path,default=ROOT/'public/models/monk.glb');p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('/tmp/vice-president.glb'));p.add_argument('--blend',type=pathlib.Path);p.add_argument('--face-texture',type=pathlib.Path,default=ROOT/'assets/characters/vice-president-albedo.png');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def read_glb(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),bytearray(raw[28+n:])
def save_glb(path,doc,data):
 doc['buffers'][0]['byteLength']=len(data);h=json.dumps(doc,separators=(',',':')).encode();h+=b' '*(-len(h)%4);data+=b'\0'*(-len(data)%4);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(h)+len(data))+struct.pack('<II',len(h),0x4e4f534a)+h+struct.pack('<II',len(data),0x004e4942)+data)
doc,data=read_glb(a.input)
if doc.get('extras',{}).get('vicePresidentLikeness'):raise ValueError('Input already contains the likeness; use the unmodified native Monk model')
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(a.input))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE');rig.animation_data_clear();mesh=next(o for o in bpy.data.objects if o.type=='MESH' and o.vertex_groups);mesh.data.use_mirror_x=False
for bone in rig.pose.bones:bone.matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
original=[v.co.copy() for v in mesh.data.vertices]
eye_groups={g.index for g in mesh.vertex_groups if g.name in ['Bip01 REye','Bip01 LEye']}
eye_vertices={v.index for v in mesh.data.vertices if any(g.group in eye_groups and g.weight>.6 for g in v.groups)}
def gaussian(x,y,z,cx,cy,cz,sx,sy,sz):return math.exp(-.5*(((x-cx)/sx)**2+((y-cy)/sy)**2+((z-cz)/sz)**2))
def sculpt(v,eye=False):
 x,y,z=v;ax=abs(x);sgn=1 if x>=0 else -1
 if z<1.48:return v.copy()
 q=Vector((x,y,z))
 # Mature, full cheeks and soft lower jaw. Dimensions are in metres.
 q.x+=sgn*.0065*gaussian(ax,y,z,.054,-.078,1.630,.03,.07,.056)
 q.y-=.0035*gaussian(ax,y,z,.04,-.103,1.635,.035,.035,.027)
 q.x+=sgn*.0035*gaussian(ax,y,z,.056,-.035,1.598,.022,.04,.028)
 jowl=gaussian(ax,y,z,.045,-.085,1.595,.021,.032,.023);q.x+=sgn*.001*jowl;q.y-=.001*jowl
 # Fill the submental region and neck without changing the neck/body seam.
 q.x+=x*.04*gaussian(x,y,z,0,-.01,1.556,.08,.12,.042)
 q.y-=.003*gaussian(x,y,z,0,-.066,1.570,.055,.025,.022)
 # Rounded prominent nose, gently lowered tip, softer nostril wings.
 nose=gaussian(x,y,z,0,-.143,1.650,.020,.021,.015)
 q.y-=.0075*nose;q.z-=.008*nose;q.x+=x*.10*nose
 q.z-=.003*gaussian(x,y,z,0,-.137,1.640,.009,.016,.010)
 q.x+=sgn*.001*gaussian(ax,y,z,.018,-.125,1.638,.010,.018,.012)
 bridge=gaussian(x,y,z,0,-.13,1.675,.012,.025,.024);q.y-=.006*bridge
 # A rounded chin rather than a square, protruding block.
 chin=gaussian(x,y,z,0,-.122,1.580,.035,.025,.024);q.x*=1+.02*chin;q.y+=.0025*chin;q.z-=.001*chin
 # Less prominent brow ridge, slightly hooded upper eyelids, fuller lower lids.
 brow=gaussian(ax,y,z,.032,-.119,1.707,.038,.03,.012);q.y+=.0025*brow
 upper=gaussian(ax,y,z,.031,-.11,1.696,.025,.018,.006);lower=gaussian(ax,y,z,.031,-.111,1.674,.023,.02,.007)
 if not eye:
  q.z-=.003*upper;q.z+=.0006*lower;q.y-=.0013*lower
  q.z-=.0016*gaussian(ax,y,z,.018,-.117,1.704,.020,.025,.009)
 # Larger ears with soft lobes; facial bone weights remain intact.
 ear=gaussian(ax,y,z,.088,-.001,1.669,.013,.04,.035);q.x+=sgn*.003*ear
 # Existing scalp supplies a textured base below the swept-back strand layer.
 cap=max(0,min(1,(z-1.736)/.055));q.z+=.013*cap;q.y+=.007*cap
 # Reference measurements show a taller forehead and a longer lower face.
 def smooth(lo,hi,value):
  t=max(0,min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t)
 if q.z>=1.700:q.z+=.012*smooth(1.700,1.748,q.z)
 elif q.z<1.685:q.z+=(q.z-1.685)*.075*smooth(1.53,1.56,q.z)
 return q
for v in mesh.data.vertices:v.co=sculpt(v.co,eye=v.index in eye_vertices)
mesh.data.update()
# Remove source beard/hair cards. They show the wrong cut and use a dark atlas.
for poly in mesh.data.polygons:
 if poly.material_index==2:poly.material_index=1
# Write Blender's native edits into the original GLB vertex streams.
# glTF import preserves the contiguous primitive vertex order for this model.
offset=0;patch_count=0;min_jacobian=1
for primitive in doc['meshes'][0]['primitives']:
 pa=doc['accessors'][primitive['attributes']['POSITION']];pv=doc['bufferViews'][pa['bufferView']];na=doc['accessors'][primitive['attributes']['NORMAL']];nv=doc['bufferViews'][na['bufferView']]
 count=pa['count'];bounds=[[],[],[]]
 for i in range(count):
  index=offset+i;start=pv.get('byteOffset',0)+pa.get('byteOffset',0)+i*pv.get('byteStride',12);v=Vector(struct.unpack_from('<3f',data,start));expected=Vector((v.x,-v.z,v.y))
  if (expected-original[index]).length>1e-5:raise ValueError(f'Native vertex correspondence changed at {index}')
  q=mesh.data.vertices[index].co;xyz=(q.x,q.z,-q.y)
  struct.pack_into('<3f',data,start,*xyz);ns=nv.get('byteOffset',0)+na.get('byteOffset',0)+i*nv.get('byteStride',12)
  if expected.z>=1.48:
   source_normal=struct.unpack_from('<3f',data,ns);n=Vector((source_normal[0],-source_normal[2],source_normal[1]));columns=[]
   for axis in range(3):
    step=Vector((0,0,0));step[axis]=.0001;columns.append((sculpt(expected+step,eye=index in eye_vertices)-sculpt(expected-step,eye=index in eye_vertices))/.0002)
   jacobian=Matrix(columns).transposed();min_jacobian=min(min_jacobian,jacobian.determinant())
   if jacobian.determinant()<=0:raise ValueError(f'Sculpt folds the native surface at vertex {index}')
   n=jacobian.inverted().transposed()@n;n.normalize();struct.pack_into('<3f',data,ns,n.x,n.z,-n.y)
  for k in range(3):bounds[k].append(xyz[k])
  if (q-original[index]).length>1e-5:patch_count+=1
 pa['min']=[min(v) for v in bounds];pa['max']=[max(v) for v in bounds];offset+=count
# Keep original alpha cards out of the rendered model. Their unused buffers stay
# untouched so all rig and animation accessors retain their original identities.
doc['meshes'][0]['primitives']=[p for p in doc['meshes'][0]['primitives'] if doc['materials'][p['material']]['name']!='m009_opacity']
def add_blob(chunk,target=None):
 data.extend(b'\0'*(-len(data)%4));view={'buffer':0,'byteOffset':len(data),'byteLength':len(chunk)}
 if target:view['target']=target
 doc.setdefault('bufferViews',[]).append(view);data.extend(chunk);return len(doc['bufferViews'])-1
image_index=doc['textures'][doc['materials'][1]['pbrMetallicRoughness']['baseColorTexture']['index']]['source'];albedo=a.face_texture.read_bytes();doc['images'][image_index]={'bufferView':add_blob(albedo),'mimeType':'image/jpeg' if a.face_texture.suffix.lower() in ['.jpg','.jpeg'] else 'image/png','name':'Ethan inspired neutral face albedo'}
# The source normal map includes a long, dense beard. Retain its fine skin detail
# at reduced strength rather than projecting that old beard onto the new stubble.
doc['materials'][1]['normalTexture']['scale']=.20
for mat in mesh.data.materials:
 if mat.name=='m009_head':
  for node in mat.node_tree.nodes:
   if node.type=='TEX_IMAGE' and node.image and 'color' in node.image.name:node.image=bpy.data.images.load(str(a.face_texture))
   if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.20
# Accessories are authored in Blender world space then stored in Head local space.
head_index=next(i for i,n in enumerate(doc['nodes']) if n.get('name')=='Head')
parents={c:i for i,n in enumerate(doc['nodes']) for c in n.get('children',[])}
def matrix(index):
 n=doc['nodes'][index]
 if 'matrix'in n:m=Matrix([n['matrix'][i:i+4] for i in range(0,16,4)]).transposed()
 else:
  q=n.get('rotation',[0,0,0,1]);m=Matrix.LocRotScale(Vector(n.get('translation',[0,0,0])),Quaternion((q[3],q[0],q[1],q[2])),Vector(n.get('scale',[1,1,1])))
 return matrix(parents[index])@m if index in parents else m
inverse_head=matrix(head_index).inverted();normal_head=inverse_head.to_3x3()
def material(name,color,roughness=.5,metal=0):
 doc.setdefault('materials',[]).append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'roughnessFactor':roughness,'metallicFactor':metal},'doubleSided':True});return len(doc['materials'])-1
frame_mat=material('Vice President graphite glasses',(.018,.024,.032),.3,.1);temple_mat=material('Vice President brushed silver temples',(.33,.35,.37),.31,.75)
accessories=[]
def tube(name,points,radius,mat,sides=5):
 verts=[];faces=[]
 for i,p in enumerate(points):
  p=Vector(p);t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized();reference=Vector((0,1,0)) if name.startswith('Glasses rim') else Vector((0,0,1));u=reference-t*reference.dot(t)
  if u.length<.01:u=Vector((1,0,0))-t*t.x
  u.normalize();w=t.cross(u).normalized()
  for k in range(sides):
   angle=math.tau*k/sides;ru,rw=radius(i) if callable(radius) else (radius,radius);ct,st=math.cos(angle),math.sin(angle);verts.append(p+u*ru*math.copysign(abs(ct)**.65,ct)+w*rw*math.copysign(abs(st)**.65,st))
  if i:
   for k in range(sides):faces.append(((i-1)*sides+k,(i-1)*sides+(k+1)%sides,i*sides+(k+1)%sides,i*sides+k))
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
 for poly in m.polygons:poly.use_smooth=True
 accessories.append((o,mat));return o
# Rounded rectangular full-rim frames. Perimeter follows the cheek curvature.
for sign in [-1,1]:
 points=[]
 for i in range(65):
  t=math.tau*i/64;ct,st=math.cos(t),math.sin(t);dx=.029*math.copysign(abs(ct)**.32,ct);dz=.018*math.copysign(abs(st)**.32,st);x=sign*.036+dx
  # Dark rectangular frames keep the eyes visible below the eyebrows.
  points.append((x,-.136+abs(x)*.1,1.681+dz))
 tube('Glasses rim '+str(sign),points,lambda i:(.0018,.0028 if points[i][2]>1.687 else .0018),frame_mat,8)
 tube('Glasses temple '+str(sign),[(sign*.066,-.128,1.692),(sign*.082,-.10,1.692),(sign*.087,-.04,1.692),(sign*.086,.004,1.688),(sign*.085,.021,1.676)],.0017,temple_mat,6)
tube('Glasses bridge',[(-.008,-.137,1.688),(-.004,-.14,1.692),(0,-.142,1.693),(.004,-.14,1.692),(.008,-.137,1.688)],.0018,frame_mat,7)
# The sculpted, textured scalp supplies the hair silhouette. Additional line
# geometry was removed after visual review: it looked like straight white wires.
# Consolidate accessory geometry by material for two extra draw calls.
for mat in sorted(set(m for _,m in accessories)):
 verts=[];normals=[];indices=[]
 for o,m in accessories:
  if m!=mat:continue
  o.data.calc_loop_triangles();base=len(verts)
  for v in o.data.vertices:
   world=o.matrix_world@v.co;g=Vector((world.x,world.z,-world.y));q=inverse_head@g;n=normal_head@Vector((v.normal.x,v.normal.z,-v.normal.y));n.normalize();verts.append(tuple(q));normals.append(tuple(n))
  for t in o.data.loop_triangles:indices.extend(base+i for i in t.vertices)
 def accessor(values,components,kind,fmt,target):
  flat=[x for v in values for x in v] if components>1 else values;chunk=struct.pack('<'+fmt*len(flat),*flat);view=add_blob(chunk,target);entry={'bufferView':view,'componentType':5126 if fmt=='f' else 5125,'count':len(values),'type':kind}
  if kind=='VEC3':entry.update(min=[min(v[i] for v in values) for i in range(3)],max=[max(v[i] for v in values) for i in range(3)])
  doc['accessors'].append(entry);return len(doc['accessors'])-1
 pa=accessor(verts,3,'VEC3','f',34962);na=accessor(normals,3,'VEC3','f',34962);ia=accessor(indices,1,'SCALAR','I',34963)
 name=doc['materials'][mat]['name'];doc['meshes'].append({'name':name,'primitives':[{'attributes':{'POSITION':pa,'NORMAL':na},'indices':ia,'material':mat}]});doc['nodes'].append({'name':name,'mesh':len(doc['meshes'])-1});doc['nodes'][head_index].setdefault('children',[]).append(len(doc['nodes'])-1)
doc.setdefault('extras',{})['vicePresidentLikeness']={'version':1,'basis':'User-supplied reference photos; geometry brief reviewed with Claude Opus 5.5 High','modifiedVertices':patch_count,'privatePhotosEmbedded':False,'retainedFacialRig':True,'minimumSculptJacobian':min_jacobian}
save_glb(a.output,doc,data)
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=str(a.blend))
print('VICE_PRESIDENT_EXPORTED',a.output,'sculpted vertices',patch_count,'accessory vertices',sum(len(o.data.vertices) for o,m in accessories))
