"""Sculpt Ethan's head and add glasses/hair without changing the native rig or clips.

Run with Blender --background --python tools/build-vice-president.py -- \
  --input public/models/monk.glb --output /tmp/vice-president.glb

The sculpt keeps native topology, UVs, joint indices, weights and animation bytes.
It patches positions and normals, then adds head-parented glasses.
Only the generated albedo is distributed. The private photos stay outside the repo.

This creates the base sculpt. The measured geometric revision uses
fit-vice-president-shape.py and its saved fit. See docs/vice-president-likeness.md.
"""
import argparse, json, math, pathlib, struct, sys
import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=pathlib.Path,default=ROOT/'public/models/monk.glb');p.add_argument('--output',type=pathlib.Path,default=pathlib.Path('/tmp/vice-president.glb'));p.add_argument('--blend',type=pathlib.Path);p.add_argument('--face-texture',type=pathlib.Path,default=ROOT/'assets/characters/vice-president-face-clean-eyes.png');p.add_argument('--hair-shape',choices=['baseline','swept'],default='swept');p.add_argument('--nose-tip-drop-mm',type=float,default=2);a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if not 0<=a.nose_tip_drop_mm<=2:p.error('--nose-tip-drop-mm must remain between 0 and 2 for this bounded revision.')
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
def smooth(lo,hi,value):
 t=max(0,min(1,(value-lo)/(hi-lo)));return t*t*(3-2*t)
# Each eye is a separate connected surface. Do not deform an eyeball with the
# cheek field: that previously stretched it and pushed the gaze outward.
mesh.data.calc_loop_triangles();uv=mesh.data.uv_layers.active
eye_transforms={};eye_reports=[]
for side in ['R','L']:
 group=mesh.vertex_groups['Bip01 '+side+'Eye'].index
 component={v.index for v in mesh.data.vertices if any(g.group==group and g.weight>.6 for g in v.groups)}
 while True:
  extended=component.copy()
  for face in mesh.data.polygons:
   if any(i in component for i in face.vertices):extended.update(face.vertices)
  if extended==component:break
  component=extended
 if not 50<=len(component)<=200:raise ValueError(f'{side} eye must be a separate connected surface, got {len(component)} vertices')
 coords=np.array([list(original[i]) for i in component]);fit=np.linalg.lstsq(np.column_stack((2*coords,np.ones(len(coords)))),(coords*coords).sum(axis=1),rcond=None)[0];center=Vector(fit[:3])
 # This is the measured dark-pupil centroid in the checked-in atlas, not the
 # centre of its UV island. Both eyes share that painted iris.
 pupil_uv=Vector((.26333088,.06703497));pupil=None
 for tri in mesh.data.loop_triangles:
  if not all(i in component for i in tri.vertices):continue
  a0,a1,a2=[uv.data[i].uv.copy() for i in tri.loops];d0,d1,d2=a1-a0,a2-a0,pupil_uv-a0;det=d0.x*d1.y-d0.y*d1.x
  if abs(det)<1e-12:continue
  b1=(d2.x*d1.y-d2.y*d1.x)/det;b2=(d0.x*d2.y-d0.y*d2.x)/det;b0=1-b1-b2
  if min(b0,b1,b2)>=-1e-5:pupil=sum((original[i]*w for i,w in zip(tri.vertices,[b0,b1,b2])),Vector());break
 if pupil is None:raise ValueError(f'{side} eye pupil does not map to the eye UV surface')
 axis=(pupil-center).normalized();rotation=axis.rotation_difference(Vector((0,-1,0)))
 corrected=[center+rotation@(original[i]-center) for i in component]
 indices=list(component);distance_error=max(abs((corrected[j]-corrected[k]).length-(original[indices[j]]-original[indices[k]]).length) for j in range(len(indices)) for k in range(j))
 if distance_error>1e-6:raise ValueError(f'{side} eyeball calibration must remain rigid, maximum distance error {distance_error}')
 for i in component:eye_transforms[i]=(center,rotation)
 eye_reports.append({'side':side,'vertices':len(component),'nativeYawDegrees':math.degrees(math.atan2(axis.x,-axis.y)),'nativePitchDegrees':math.degrees(math.asin(axis.z)),'correctedAxis':list(rotation@axis),'center':list(center),'maximumPairDistanceErrorMetres':distance_error})
def gaussian(x,y,z,cx,cy,cz,sx,sy,sz):return math.exp(-.5*(((x-cx)/sx)**2+((y-cy)/sy)**2+((z-cz)/sz)**2))
# Conservative metric corrections from two independently fitted reference cameras.
# Depth stays unchanged because both photographs have uncertain intrinsics.
EYE_SHIFT_X=.00125
EYE_SHIFT_Z=-.00125
def eye_shift(center):return Vector((EYE_SHIFT_X if center.x>0 else -EYE_SHIFT_X,0,EYE_SHIFT_Z))
def refine_landmarks(q):
 x,y,z=q;ax=abs(x);sign=1 if x>=0 else -1;delta=Vector()
 front=1-smooth(-.075,-.03,y)
 orbit=smooth(.002,.012,ax)*(1-smooth(.053,.075,ax))*smooth(1.648,1.672,z)*(1-smooth(1.714,1.733,z))*front
 delta.x+=sign*EYE_SHIFT_X*orbit;delta.z+=EYE_SHIFT_Z*orbit
 # Extend the outer lid rather than treating lens-distorted corner detections
 # as a request to move the entire eyeball three millimetres sideways.
 outer=gaussian(ax,y,z,.042,-.110,1.685,.010,.026,.009)
 delta.x+=sign*.002*outer*front
 # Compress the lower face while retaining the user's slimmer jaw width.
 lower=max(0,min(1,(1.635-z)/.075))*smooth(1.49,1.545,z)*front
 delta.z+=.002*lower
 mouth=math.exp(-.5*((z-1.612)/.018)**2)*(1-smooth(.045,.065,ax))*front
 corner=smooth(.008,.022,ax)*mouth
 delta.x+=sign*.00125*corner;delta.z+=.0004*mouth+.00065*corner
 # Nose width is outside the prescription lenses and agrees across both views.
 # Keep its profile and projection unchanged.
 sign_soft=x/math.sqrt(x*x+.000004)
 delta.x+=sign_soft*(.0015*gaussian(ax,y,z,.016,-.135,1.639,.014,.018,.011)+.00075*gaussian(ax,y,z,.008,-.152,1.649,.009,.012,.011))
 return q+delta
def sculpt(v,eye=None,landmarks=True):
 if eye is not None:
  center,rotation=eye;return center+rotation@(v-center)+eye_shift(center)
 x,y,z=v;ax=abs(x);sgn=1 if x>=0 else -1
 if z<1.48:return v.copy()
 q=Vector((x,y,z))
 # Keep cheekbone volume high on the face. The reference has an oval jaw,
 # not the source model's broad parallel-sided lower face.
 cheek=gaussian(ax,y,z,.054,-.078,1.637,.030,.05,.038)*(1-smooth(1.653,1.680,z))
 q.x+=sgn*.0032*cheek
 q.y-=.0035*gaussian(ax,y,z,.04,-.103,1.635,.035,.035,.027)
 front=1-smooth(-.025,.010,y)
 taper=.035*math.exp(-.5*((z-1.583)/.029)**2)*front*smooth(1.528,1.559,z)
 q.x*=1-taper
 q.x-=sgn*.0022*gaussian(ax,y,z,.056,-.035,1.598,.022,.04,.028)
 # Fill the submental region and neck without changing the neck/body seam.
 q.y-=.003*gaussian(x,y,z,0,-.066,1.570,.055,.025,.022)
 # Rounded prominent nose and softer nostril wings. The bounded distal-tip
 # correction below acts after these source-proportion adjustments.
 nose=gaussian(x,y,z,0,-.143,1.650,.020,.021,.015)
 q.y-=.0075*nose;q.z+=.003*nose;q.x+=x*.10*nose
 q.z-=.001*gaussian(x,y,z,0,-.137,1.640,.009,.016,.010)
 q.x+=sgn*.001*gaussian(ax,y,z,.018,-.125,1.638,.010,.018,.012)
 bridge=gaussian(x,y,z,0,-.13,1.675,.012,.025,.024);q.y-=.006*bridge
 # Fill the steep source subnasal shelf into a round philtrum. Its downward
 # normals otherwise make a false dark moustache under the lifted nose.
 q.y-=.0045*gaussian(x,y,z,0,-.129,1.6335,.022,.024,.006)
 # A rounded chin rather than a square, protruding block.
 chin=gaussian(x,y,z,0,-.122,1.580,.035,.025,.024);q.x*=1-.025*chin;q.y-=.004*chin;q.z-=.001*chin
 mouth=gaussian(x,y,z,0,-.125,1.618,.037,.025,.016);q.x+=x*.06*mouth;q.y+=.001*mouth
 # Less prominent brow ridge, slightly hooded upper eyelids, fuller lower lids.
 brow=gaussian(ax,y,z,.032,-.119,1.707,.038,.03,.012);q.y+=.0025*brow
 upper=gaussian(ax,y,z,.031,-.11,1.696,.025,.018,.006);lower=gaussian(ax,y,z,.031,-.111,1.674,.023,.02,.007)
 q.z-=.003*upper;q.z+=.0006*lower;q.y-=.0013*lower
 q.z-=.0016*gaussian(ax,y,z,.018,-.117,1.704,.020,.025,.009)
 # Larger ears with soft lobes; facial bone weights remain intact.
 ear=gaussian(ax,y,z,.088,-.001,1.669,.013,.04,.035);q.x+=sgn*.003*ear
 # Existing scalp supplies a textured base below the swept-back strand layer.
 cap=max(0,min(1,(z-1.736)/.055));q.z+=.009*cap;q.y+=.007*cap
 q.x+=sgn*.0045*gaussian(ax,y,z,.065,.005,1.748,.020,.080,.034)
 q.z+=.003*gaussian(x,y,z,0,.006,1.784,.044,.10,.025)
 q.z+=.003*gaussian(x,y,z,0,-.059,1.770,.038,.035,.025)
 q.x+=sgn*.0015*gaussian(ax,y,z,.065,-.030,1.711,.013,.06,.020)
 # The seated three-quarter and capped profile references show a lower, gently
 # receding forehead. Preserve its convex transition rather than flattening it.
 q.y-=.0075*gaussian(x,y,z,0,-.074,1.743,.056,.060,.032)*smooth(1.704,1.731,z)
 # Keep the forehead extension modest; the longer lower face remains unchanged.
 if q.z>=1.700:q.z+=.008*smooth(1.700,1.748,q.z)
 elif q.z<1.685:q.z+=(q.z-1.685)*.12*smooth(1.48,1.575,q.z)
 if landmarks and a.hair_shape=='swept':
  # Lift the front sweep without moving the forehead or adding crown height.
  crest=gaussian(x,y,z,-.018,-.047,1.778,.047,.046,.027)*smooth(1.746,1.771,z)
  q.z+=.007*crest;q.y+=.004*crest
  # The reference has longer hair behind the ears, not a close-cropped cap.
  back=smooth(-.002,.030,y)*smooth(1.660,1.710,z)*(1-smooth(1.752,1.800,z))
  q.y+=.010*back
  sides=smooth(.053,.075,ax)*(1-smooth(.005,.048,y))*smooth(-.040,-.003,y)*smooth(1.685,1.715,z)*(1-smooth(1.749,1.780,z))
  q.x+=sgn*.003*sides;q.y+=.004*sides
 if landmarks and a.nose_tip_drop_mm:
  # The original sculpt raised the distal tip. A clay diagnostic confirmed a
  # real horizontal subnasal shelf, while the profile shows a lower tip.
  distal=smooth(.140,.154,-q.y)*smooth(1.624,1.639,q.z)*(1-smooth(1.659,1.687,q.z))*math.exp(-.5*(q.x/.026)**2)
  q.z-=a.nose_tip_drop_mm*.001*distal
 return refine_landmarks(q) if landmarks else q
for v in mesh.data.vertices:v.co=sculpt(v.co,eye=eye_transforms.get(v.index),landmarks=v.index>=2837)
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
    step=Vector((0,0,0));step[axis]=.0001;columns.append((sculpt(expected+step,eye=eye_transforms.get(index),landmarks=index>=2837)-sculpt(expected-step,eye=eye_transforms.get(index),landmarks=index>=2837))/.0002)
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
# Constant parents translate the eye rotation centres without changing any clip
# keys. Their old local transforms and all animation accessors remain intact.
eye_pivot_updates=[]
for side in ['R','L']:
 eye_index=next(i for i,n in enumerate(doc['nodes']) if n.get('name')=='Bip01 '+side+'Eye')
 parent_index=parents[eye_index];old_world=matrix(eye_index);parent_world=matrix(parent_index)
 sign=-1 if side=='R' else 1;world_delta=Vector((sign*EYE_SHIFT_X,EYE_SHIFT_Z,0))
 local_delta=parent_world.to_3x3().inverted()@world_delta
 offset_index=len(doc['nodes']);doc['nodes'].append({'name':'Vice President '+side+' eye pivot offset','translation':list(local_delta),'children':[eye_index]})
 doc['nodes'][parent_index]['children']=[offset_index if i==eye_index else i for i in doc['nodes'][parent_index]['children']]
 skin_updates=[]
 for skin_index,skin in enumerate(doc.get('skins',[])):
  if eye_index not in skin['joints']:continue
  joint=skin['joints'].index(eye_index);accessor=doc['accessors'][skin['inverseBindMatrices']];view=doc['bufferViews'][accessor['bufferView']]
  start=view.get('byteOffset',0)+accessor.get('byteOffset',0)+joint*view.get('byteStride',64)
  old=Matrix([struct.unpack_from('<4f',data,start+k*16) for k in range(4)]).transposed()
  new=old@Matrix.Translation(-world_delta)
  struct.pack_into('<16f',data,start,*[new[row][column] for column in range(4) for row in range(4)])
  skin_updates.append({'skin':skin_index,'joint':joint,'node':eye_index})
 eye_pivot_updates.append({'side':side,'node':eye_index,'parent':parent_index,'offsetNode':offset_index,'worldDelta':list(world_delta),'localDelta':list(local_delta),'skinUpdates':skin_updates})

def material(name,color,roughness=.5,metal=0):
 doc.setdefault('materials',[]).append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':[*color,1],'roughnessFactor':roughness,'metallicFactor':metal},'doubleSided':True});return len(doc['materials'])-1
frame_mat=material('Vice President graphite glasses',(.035,.045,.055),.26,.82);temple_mat=material('Vice President brushed silver temples',(.8,.82,.84),.24,.65)
accessories=[]
def tube(name,points,radius,mat,sides=5):
 verts=[];faces=[]
 for i,p in enumerate(points):
  p=Vector(p);t=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized();reference=Vector((0,1,0)) if name.startswith('Glasses rim') else Vector((0,0,1));u=reference-t*reference.dot(t)
  if u.length<.01:u=Vector((1,0,0))-t*t.x
  u.normalize();w=t.cross(u).normalized()
  for k in range(sides):
   angle=math.tau*k/sides;ru,rw=radius(i) if callable(radius) else (radius,radius);ct,st=math.cos(angle),math.sin(angle);shape=.25 if name.startswith('Glasses rim') else .65;verts.append(p+u*ru*math.copysign(abs(ct)**shape,ct)+w*rw*math.copysign(abs(st)**shape,st))
  if i:
   for k in range(sides):faces.append(((i-1)*sides+k,(i-1)*sides+(k+1)%sides,i*sides+(k+1)%sides,i*sides+k))
 m=bpy.data.meshes.new(name);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
 for poly in m.polygons:poly.use_smooth=True
 accessories.append((o,mat));return o
# The lens outline comes from a manually traced photograph, not a superellipse.
# Remove camera/head roll using the pupil line before creating the 3D frame.
trace=json.loads((ROOT/'assets/characters/vice-president-glasses-trace.json').read_text())
(a0,a1)=trace['pupilBaseline'];angle=-math.atan2(a1[1]-a0[1],a1[0]-a0[0]);ct,st=math.cos(angle),math.sin(angle)
outline=[(x*ct-y*st,-(x*st+y*ct)) for x,y in trace['outline']]
lo=[min(p[i] for p in outline) for i in range(2)];hi=[max(p[i] for p in outline) for i in range(2)];mid=[(a+b)/2 for a,b in zip(lo,hi)];half=[(b-a)/2 for a,b in zip(lo,hi)]
outline=[Vector(((x-mid[0])/half[0],(z-mid[1])/half[1])) for x,z in outline]
half_width=trace['lensWidthMetres']/2;half_height=half_width/(half[0]/half[1]*trace['perspectiveWidthCorrection'])
def traced_rim(t):
 u=t*len(outline);i=int(u);v=u-i
 p0,p1,p2,p3=[outline[(i+k)%len(outline)] for k in [-1,0,1,2]]
 return .5*((2*p1)+(-p0+p2)*v+(2*p0-5*p1+4*p2-p3)*v*v+(-p0+3*p1-3*p2+p3)*v*v*v)
for sign in [-1,1]:
 points=[]
 for i in range(65):
  u,v=traced_rim(i/64);dx=sign*half_width*u;dz=half_height*v;x=sign*.035+dx
  points.append((x,-.136+abs(x)*.14-dz*.14,trace['lensCenterHeightMetres']+dz))
 tube('Glasses rim '+str(sign),points,lambda i:(.00055,.00065 if points[i][2]>1.690 else .00050),frame_mat,8)
 tube('Glasses temple '+str(sign),[(sign*.0625,-.129,1.693),(sign*.079,-.10,1.690),(sign*.087,-.04,1.685),(sign*.089,.004,1.680),(sign*.088,.021,1.666)],lambda i:(.0009,.00145),temple_mat,6)
tube('Glasses bridge',[(-.008,-.137,1.688),(-.004,-.14,1.692),(0,-.142,1.693),(.004,-.14,1.692),(.008,-.137,1.688)],.00065,frame_mat,7)
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
doc.setdefault('extras',{})['vicePresidentLikeness']={'version':4,'basis':'Two-photo camera-adjusted landmark refinement with local profile, material, and expression review','hairShape':a.hair_shape,'noseTipDropMm':a.nose_tip_drop_mm,'eyePivotOffsets':eye_pivot_updates,'modifiedVertices':patch_count,'privatePhotosEmbedded':False,'retainedFacialRig':True,'minimumSculptJacobian':min_jacobian,'rigidEyeCalibration':eye_reports}
save_glb(a.output,doc,data)
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=str(a.blend))
print('VICE_PRESIDENT_EXPORTED',a.output,'sculpted vertices',patch_count,'accessory vertices',sum(len(o.data.vertices) for o,m in accessories))
